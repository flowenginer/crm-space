

## Plano: Adicionar botão "Fechar" na barra de ações em massa da página de Conversas

### Problema
A barra de seleção em massa na página de Conversas tem "Todas", "Não lidas", "Transferir", "Devolver", "Etiquetar" e "Cancelar", mas **não tem "Fechar"**. O componente `BulkCloseModal` já existe e funciona na página de Relatórios.

### Alteração
**Arquivo único:** `src/pages/Conversations.tsx`

1. **Importar** `BulkCloseModal` (já existente em `@/components/conversations/BulkCloseModal`)
2. **Adicionar estado** `showBulkCloseModal` (useState boolean)
3. **Adicionar botão "Fechar"** na barra de ações em massa (linha ~4658), entre "Etiquetar" e "Cancelar", com ícone `XCircle` e variante `outline`
4. **Adicionar o modal** `<BulkCloseModal>` ao lado dos outros modais (~linha 4694), passando `conversationIds` e `onSuccess` para limpar seleção

Nenhuma estrutura existente será alterada — apenas adição de um botão e do modal já pronto.

