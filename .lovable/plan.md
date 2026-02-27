

# Adicionar "Etiquetar em Massa" na barra de selecao de conversas

## Resumo

Adicionar um botao "Etiquetar" na barra flutuante de acoes em massa que aparece ao selecionar conversas na pagina principal. O componente `BulkTagModal` ja existe e esta funcionando na pagina de Relatorios -- basta reutiliza-lo na pagina de Conversas.

## O que muda para o usuario

Ao ativar o modo de selecao e escolher conversas, a barra flutuante (que hoje mostra: Todas, Nao lidas, Transferir, Devolver, Cancelar) passara a ter tambem o botao **Etiquetar** (com icone de tag). Ao clicar, abre o modal onde o usuario pode adicionar ou remover uma etiqueta de todos os contatos das conversas selecionadas.

## Risco de impacto

**Nenhum.** O componente `BulkTagModal` ja esta em producao na pagina de Relatorios. Estamos apenas adicionando mais um botao na barra e reutilizando o mesmo componente. Nenhuma logica existente sera alterada.

## Detalhes tecnicos

### Arquivo alterado: `src/pages/Conversations.tsx`

1. **Novo estado**: `showBulkTagModal` (boolean, inicialmente false)
2. **Derivar contactIds**: Mapear `selectedConversationIds` para os `contact_id` das conversas usando `filteredConversations` (as conversas ja possuem `contact_id`)
3. **Novo botao** na barra flutuante (entre "Devolver" e "Cancelar"):
   - Icone: `Tag` do lucide-react
   - Texto: "Etiquetar"
   - Abre o `BulkTagModal`
4. **Importar** `BulkTagModal` e o icone `Tag`
5. **Renderizar** o `BulkTagModal` com os `contactIds` derivados, junto ao `BulkTransferModal` ja existente

