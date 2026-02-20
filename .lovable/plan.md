
# Correção: `sender_type` não existe — substituir por `is_from_me`

## Causa Raiz Confirmada

A tabela `messages` não possui a coluna `sender_type`. A coluna correta para identificar quem enviou a mensagem é `is_from_me` (boolean):

- `is_from_me = true` → mensagem enviada pelo agente
- `is_from_me = false` → mensagem enviada pelo contato

A função `search_conversations_report` criada pelas migrations anteriores referencia `m.sender_type = 'contact'` e `m.sender_type = 'agent'` em três lugares, o que causa o erro `column m.sender_type does not exist` toda vez que o relatório é gerado.

## O Que Precisa Mudar

Dentro do corpo da função, nos três subqueries de mensagens:

```sql
-- ERRADO (atual):
AND m.sender_type = 'contact'   -- first_message
AND m.sender_type = 'agent'     -- sent_messages_count
AND m.sender_type = 'contact'   -- received_messages_count

-- CORRETO (após fix):
AND m.is_from_me = false        -- first_message (contato enviou)
AND m.is_from_me = true         -- sent_messages_count (agente enviou)
AND m.is_from_me = false        -- received_messages_count (contato enviou)
```

## Solução

Uma nova migration SQL que:

1. **Dropa** a versão atual da função (assinatura `text, text, text, text, text[], text[], text[], text[], text[], text[], integer, integer`)
2. **Recria** a função completa com a correção dos três `sender_type` → `is_from_me`
3. **Mantém** todos os outros campos intactos: `internal_notes_text`, `first_response_at`, `total_active_time_seconds`, `contact_lead_score`, etc.
4. **Re-concede** permissão `EXECUTE` ao role `authenticated`
5. **Notifica** o PostgREST com `NOTIFY pgrst, 'reload schema'`

## Arquivos Afetados

1. **Nova migration SQL** — única alteração necessária, no banco de dados
2. **Nenhuma mudança no frontend** — `ConversationReport.tsx` está correto

## Resultado Esperado

Após a migration, ao clicar em "Gerar" no relatório de atendimentos, os contatos e dados serão carregados normalmente.
