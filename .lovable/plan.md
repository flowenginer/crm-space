

# Correção: Download do Relatório de Atendimentos Incompleto

## Problema Identificado

O download do relatório de atendimentos está exportando uma planilha **incompleta**:

1. **Tags** - Estão sendo exportadas parcialmente (linha 364), mas precisamos verificar se funcionam corretamente
2. **Status do Lead** - **NÃO ESTÁ SENDO EXPORTADO** - O campo existe nos dados (`contact_lead_status`) mas não aparece na planilha

## Análise do Código Atual

### Dados disponíveis (linha 220):
```typescript
contact: {
  full_name: row.contact_full_name,
  phone: row.contact_phone,
  lead_status: row.contact_lead_status  // ✅ EXISTE nos dados!
}
```

### Exportação Excel atual (linhas 357-369):
```typescript
const excelData = dataToExport.map((conv: any) => ({
  '#': conv.protocol_number,
  'Nome': conv.contact?.full_name || '',
  'Contato': conv.contact?.phone || '',
  'Canal': conv.channel?.name || '',
  'Agente': conv.assigned_user?.full_name || '',
  'Departamento': conv.department?.name || '',
  'Etiquetas': conv.tags?.map((t: any) => t.tag?.name).join(', ') || '',
  'Data Abertura': format(...),
  'Data Fechamento': conv.closed_at ? format(...) : '',
  '1ª Mensagem': conv.first_message || '',
  'Status': conv.status === 'open' ? 'Ativo' : ...
  // ❌ FALTA: 'Status do Lead': conv.contact?.lead_status || ''
}));
```

## Campos Faltantes no Excel

| Campo | Situação |
|-------|----------|
| Status do Lead | **Não está sendo exportado** (mas os dados existem) |
| Motivo do Fechamento | Não está sendo exportado (dados disponíveis em `close_reason`) |

## Solução

### Modificar função `handleExportExcel` no arquivo `src/pages/ConversationReport.tsx`

**Linha 357-369 - Adicionar campos faltantes:**

```typescript
const excelData = dataToExport.map((conv: any) => ({
  '#': conv.protocol_number,
  'Nome': conv.contact?.full_name || '',
  'Contato': conv.contact?.phone || '',
  'Status do Lead': conv.contact?.lead_status || '',    // ← ADICIONAR
  'Canal': conv.channel?.name || '',
  'Agente': conv.assigned_user?.full_name || '',
  'Departamento': conv.department?.name || '',
  'Etiquetas': conv.tags?.map((t: any) => t.tag?.name).join(', ') || '',
  'Status Conversa': conv.status === 'open' ? 'Ativo' : conv.status === 'pending' ? 'Pendente' : 'Fechado',
  'Motivo Fechamento': conv.close_reason || '',         // ← ADICIONAR (opcional)
  'Data Abertura': format(new Date(conv.created_at), 'dd/MM/yyyy HH:mm'),
  'Data Fechamento': conv.closed_at ? format(new Date(conv.closed_at), 'dd/MM/yyyy HH:mm') : '',
  '1ª Mensagem': conv.first_message || ''
}));
```

## Arquivo a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/pages/ConversationReport.tsx` | Adicionar `Status do Lead` e `Motivo Fechamento` na função `handleExportExcel` (linhas 357-369) |

## Resultado Esperado

A planilha Excel exportada terá as seguintes colunas:

| # | Nome | Contato | **Status do Lead** | Canal | Agente | Departamento | Etiquetas | Status Conversa | **Motivo Fechamento** | Data Abertura | Data Fechamento | 1ª Mensagem |

## Notas Técnicas

- Os dados do `lead_status` já vêm da função SQL `search_conversations_report` como `contact_lead_status`
- O campo `close_reason` já existe na resposta mas não estava sendo exportado
- A coluna "Status" foi renomeada para "Status Conversa" para evitar confusão com "Status do Lead"

