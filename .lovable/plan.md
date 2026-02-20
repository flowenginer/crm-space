
# Melhorias no Relatório de Atendimentos

## O Que Será Implementado

### Funcionalidade 1 — Configurador de Colunas para Export

Um modal de configuração que aparece ao clicar no botão Excel (ou num ícone de configuração ao lado dele), permitindo:
- **Marcar/desmarcar** quais colunas incluir no arquivo baixado
- **Reordenar as colunas** via drag-and-drop (usando o `@dnd-kit/sortable` já instalado no projeto)
- As configurações ficam salvas no `localStorage` do navegador (persistem entre sessões)

As colunas disponíveis (todas as que já existem hoje no export):
- `#` (Protocolo)
- Nome
- Contato (Telefone)
- Origem
- Plataforma Anúncio
- URL Anúncio
- Status do Lead
- Canal
- Agente
- Departamento
- Etiquetas
- Status Conversa
- Motivo Fechamento
- Data Abertura
- Data Fechamento
- 1ª Mensagem

O botão Excel terá um pequeno ícone de engrenagem ao lado. Ao clicar, abre um Sheet/Dialog com a lista de colunas, checkboxes e alças de drag.

---

### Funcionalidade 2 — "Selecionar Todos" Cross-Page

Hoje o `handleSelectAll` só seleciona os 50 da página atual. A nova lógica será:

**Fluxo ao clicar no checkbox do header:**
1. Se nada está selecionado → seleciona os 50 da página atual
2. Se os 50 da página atual estão selecionados E há mais páginas → aparece um banner:

```text
┌───────────────────────────────────────────────────────────────┐
│ 50 atendimentos desta página selecionados.                     │
│ [Selecionar todos os 847 atendimentos do filtro atual]         │
└───────────────────────────────────────────────────────────────┘
```

3. Ao clicar no banner → estado `selectAllPages = true` é ativado
4. O export e as ações em massa respeitam esse estado:
   - **Export Excel**: faz uma query sem paginação (todos os IDs do filtro atual) e baixa tudo
   - **Ações em massa** (transferir, fechar, etc.): passam `selectAllPages: true` para as funções existentes

**Implementação técnica:**
- Um estado `selectAllPages: boolean` é adicionado
- Quando `selectAllPages = true`, o export chama o RPC `search_conversations_report` com `p_page_size = total` para buscar tudo de uma vez antes de gerar o Excel
- Um banner amarelo aparece abaixo da tabela header com a opção de expandir a seleção

---

## Arquivos a Modificar

### Único arquivo: `src/pages/ConversationReport.tsx`

Todas as mudanças ficam neste arquivo. Não há necessidade de criar componentes novos.

**Adições no estado:**
```typescript
// Configuração de colunas (persiste em localStorage)
const [columnConfig, setColumnConfig] = useState<ColumnDef[]>(defaultColumns);
const [showColumnSettings, setShowColumnSettings] = useState(false);

// Seleção cross-page
const [selectAllPages, setSelectAllPages] = useState(false);
```

**Estrutura de coluna:**
```typescript
type ColumnDef = {
  key: string;        // ex: 'protocol_number'
  label: string;      // ex: '#'
  enabled: boolean;   // visível/incluído no export
  order: number;      // posição
}
```

**Lógica do export atualizada:**
```typescript
const handleExportExcel = async () => {
  let dataToExport;
  
  if (selectAllPages) {
    // Busca TODOS os registros sem paginação
    const { data } = await supabase.rpc('search_conversations_report', {
      ...appliedFilters,
      p_page: 1,
      p_page_size: reportData.total  // busca tudo
    });
    dataToExport = data;
  } else {
    dataToExport = selectedRows.size > 0
      ? reportData.conversations.filter(c => selectedRows.has(c.id))
      : reportData.conversations;
  }
  
  // Aplica apenas as colunas habilitadas, na ordem configurada
  const activeColumns = columnConfig
    .filter(col => col.enabled)
    .sort((a, b) => a.order - b.order);
    
  const excelData = dataToExport.map(conv => 
    Object.fromEntries(activeColumns.map(col => [col.label, getFieldValue(conv, col.key)]))
  );
  // ... gera Excel
};
```

**Modal de configuração de colunas:**
- Usa `@dnd-kit/sortable` (já instalado) para drag-and-drop
- Botão "Restaurar padrão" que volta para todas as colunas habilitadas na ordem original
- Salva automaticamente no `localStorage` com chave `conversation-report-columns`

**Banner de seleção cross-page:**
```text
Aparece entre o header da tabela e as linhas, quando selectAll = true E total > pageSize:

[⚠] 50 atendimentos desta página foram selecionados.
    Clique aqui para selecionar todos os 847 atendimentos →  [Selecionar todos] [Cancelar]
```

---

## Compatibilidade

- O export normal (sem seleção) continua funcionando igual — baixa a página atual
- Usuários que nunca configuraram colunas veem o comportamento padrão (todas as colunas)
- O localStorage garante que a configuração persiste entre sessões no mesmo browser
- Nenhuma mudança no banco de dados ou edge functions

