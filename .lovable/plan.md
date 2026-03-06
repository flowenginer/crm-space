

## Problema Identificado

As etiquetas são adicionadas na tabela **`contact_tags`** (vinculadas ao contato), mas o relatório de atendimentos busca da tabela **`conversation_tags`** (vinculadas à conversa). Como ninguém escreve na `conversation_tags`, as etiquetas aparecem vazias no relatório.

## Solução

Alterar o relatório (`ConversationReport.tsx`) para buscar etiquetas da tabela `contact_tags` usando o `contact_id` de cada conversa, em vez de buscar de `conversation_tags` usando o `conversation_id`.

### Alterações em `src/pages/ConversationReport.tsx`

**1. Query principal (linhas ~405-418)** - Trocar `conversation_tags` por `contact_tags`:
- Buscar de `contact_tags` usando `contact_id` (que já está disponível no resultado)
- Agrupar por `contact_id` em vez de `conversation_id`
- Mapear os resultados para cada conversa via `conv.contact_id`

**2. Query de exportação (linhas ~557-573)** - Mesma mudança:
- Trocar `conversation_tags` por `contact_tags` usando os `contact_id`s das conversas exportadas

**3. Filtro de tags no RPC `search_conversations_report`** - Verificar se o filtro `p_tag_ids` filtra por `conversation_tags` ou `contact_tags`:
- Se filtra por `conversation_tags`, precisa ser alterado na function do banco para filtrar por `contact_tags`

### Correção dos Build Errors existentes

**4. Edge function `cross-reference-sales/index.ts` (linha 445)** - Cast `error` de `unknown`:
- `(error as Error).message`

**5. `BulkRescueModal.tsx` (linha 151)** - Adicionar `tenant_id` ao insert

**6. `useInAppNotifications.ts`** - Tabela `in_app_notifications` não existe nos types. Usar cast `as any` ou adicionar à tipagem.

