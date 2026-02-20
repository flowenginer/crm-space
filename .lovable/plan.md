
# Correção: Erro de Ambiguidade "id" na Função RPC

## Causa Raiz

A função `search_conversations_report` possui um campo `id uuid` declarado no `RETURNS TABLE(...)`. Dentro do corpo PL/pgSQL, a linha:

```sql
SELECT tenant_id INTO v_tenant_id
FROM profiles
WHERE id = auth.uid();
```

...causa erro de ambiguidade porque o PostgreSQL não distingue se `id` se refere à coluna `profiles.id` ou ao campo de retorno `id` do `RETURNS TABLE`. Isso faz a função falhar imediatamente, retornando 0 resultados e deixando o relatório em loop de carregamento.

## Solução

Criar uma nova migration que **dropa e recria** a função com uma correção simples: qualificar `id` com o alias da tabela na query de lookup do tenant:

```sql
-- Antes (ambíguo):
WHERE id = auth.uid();

-- Depois (correto):
WHERE profiles.id = auth.uid();
```

Todos os outros campos da função ficam intactos — `internal_notes_text`, `sent_messages_count`, `received_messages_count`, `contact_lead_score`, `first_response_at`, `total_active_time_seconds` — a única mudança é essa qualificação da coluna.

## Arquivos Afetados

1. **Nova migration SQL** — DROP da função atual + recriação com `profiles.id = auth.uid()` + `NOTIFY pgrst, 'reload schema'`.
2. **Nenhuma alteração no frontend** — o `ConversationReport.tsx` está correto.

## Resultado Esperado

Após a migration, a função será executada sem erro de ambiguidade, e o relatório voltará a carregar os atendimentos normalmente ao clicar em "Gerar".
