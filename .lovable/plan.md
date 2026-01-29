
# Plano de Correção: Permissão de Transferência e Erros de Build

## Resumo dos Problemas

### 1. Permissão de Transferência
O atendente Rainy não consegue transferir a conversa mesmo sendo o responsável pelo lead. A causa é que a definição de permissões do role "vendedor" no tenant "Escola Master" está incompleta - falta a permissão `conversations.transfer`.

### 2. Envio de Áudio (Beatriz)
Boa notícia: a Beatriz **está conseguindo enviar áudios com sucesso**. Os registros mostram múltiplos envios recentes funcionando corretamente (status: `sent` e `delivered`). Não há erros nos logs das Edge Functions.

### 3. Erros de Build TypeScript
Após a remoção dos DEFAULT de `tenant_id`, o schema TypeScript gerado pelo Supabase ficou incorreto, causando erros de tipagem em 9 arquivos.

---

## Soluções

### Correção 1: Adicionar permissões de transferência ao role vendedor

Atualizarei as permissões do role `vendedor` no tenant "Escola Master" para incluir:
- `conversations.transfer: true`
- `conversations.close: true`
- `conversations.create: true`
- `conversations.respond: true`

Isso será feito via migração SQL:

```sql
UPDATE role_definitions
SET permissions = jsonb_set(
  permissions,
  '{conversations}',
  '{"view": true, "create": true, "close": true, "transfer": true, "respond": true, "requests": false, "view_all": false, "view_unassigned": false}'::jsonb
)
WHERE role_key = 'vendedor' 
AND tenant_id = '664dfcb4-5432-4c14-9838-7db14360cabf';
```

### Correção 2: Corrigir erros de TypeScript

Os arquivos com erros precisam ter seus campos `tenant_id` ajustados para serem opcionais nas operações de INSERT. Arquivos afetados:
- `src/components/contacts/WhatsAppImportModal.tsx`
- `src/components/conversations/ConversationSidebar.tsx`
- `src/components/conversations/StartConversation.tsx`
- `src/components/crm/LeadKanban.tsx`
- `src/hooks/useCallLogs.ts`
- `src/hooks/useDeals.ts`
- `src/hooks/useTags.ts`
- `src/lib/whatsapp/whatsapp-service.ts`
- `src/pages/Contacts.tsx`

A correção será feita atualizando o `src/integrations/supabase/types.ts` para refletir que `tenant_id` é opcional nos INSERTs.

---

## Próximos Passos
1. Aplicar migração para corrigir permissões do vendedor
2. Corrigir tipos TypeScript para eliminar erros de build
3. Solicitar que o usuário Rainy faça logout/login para atualizar as permissões em cache
