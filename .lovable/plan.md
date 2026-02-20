
# Adicionar Novas Colunas ao Relatório de Atendimentos

## Resumo das Mudanças

### 1. Novas Colunas para Export (5 novas)

| Coluna | Fonte | Cálculo |
|---|---|---|
| Tempo 1º Atendimento | `conversations.first_response_at` - `conversations.created_at` | Diferença em minutos/horas |
| Tempo Total Atendimento | `conversations.total_active_time_seconds` | Converter segundos para hh:mm:ss |
| Msgs Enviadas | Contagem de `messages` onde `is_from_me = true` | Agregação no RPC |
| Msgs Recebidas | Contagem de `messages` onde `is_from_me = false` | Agregação no RPC |
| Score do Lead | `contacts.lead_score` | Já existe na tabela, falta retornar |

### 2. Correção Visual — Coluna `#` cortada

O screenshot mostra que o header da tabela começa com "NOME" cortado — a coluna `#` (protocolo) está sendo cortada pela borda esquerda. Isso acontece porque o `overflow-x-auto` está no container interno mas o padding `px-6` do container externo não tem `min-width`. A correção é garantir que o container da tabela não esconça o conteúdo.

---

## Mudanças Técnicas

### Arquivo 1: Nova Migration SQL

O RPC `search_conversations_report` precisa ser atualizado para retornar os novos campos. A migration irá recriar a função adicionando:

```sql
-- Novos campos no RETURN:
first_response_at timestamp with time zone,
total_active_time_seconds integer,
contact_lead_score integer,
sent_messages_count bigint,    -- COUNT messages WHERE is_from_me = true
received_messages_count bigint -- COUNT messages WHERE is_from_me = false
```

No SELECT da função, adicionamos:
```sql
c.first_response_at,
c.total_active_time_seconds,
ct.lead_score as contact_lead_score,
COUNT(CASE WHEN m.is_from_me = true THEN 1 END) as sent_messages_count,
COUNT(CASE WHEN m.is_from_me = false THEN 1 END) as received_messages_count
```

O JOIN com a tabela `messages` já pode ser feito via LEFT JOIN usando `m.conversation_id = c.id`.

**Atenção**: Como a função usa `DISTINCT ON (c.id)` e precisamos de agregações, a query será reestruturada usando um subquery/CTE para separar a agregação de mensagens do DISTINCT ON.

### Arquivo 2: `src/pages/ConversationReport.tsx`

**Novas colunas no `DEFAULT_COLUMNS`:**
```typescript
{ key: 'first_response_time', label: 'Tempo 1º Atendimento', enabled: false },
{ key: 'total_active_time', label: 'Tempo Total Atendimento', enabled: false },
{ key: 'sent_messages_count', label: 'Msgs Enviadas', enabled: false },
{ key: 'received_messages_count', label: 'Msgs Recebidas', enabled: false },
{ key: 'lead_score', label: 'Score do Lead', enabled: false },
```

> Novas colunas chegam como `enabled: false` por padrão — não quebra o comportamento atual de nenhum usuário.

**Novas entradas na função `getFieldValue`:**
```typescript
case 'first_response_time': {
  if (!conv.first_response_at || !conv.created_at) return '-';
  const diffMs = new Date(conv.first_response_at).getTime() - new Date(conv.created_at).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const remaining = mins % 60;
  return `${hrs}h ${remaining}min`;
}
case 'total_active_time': {
  const secs = conv.total_active_time_seconds;
  if (!secs) return '-';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
case 'sent_messages_count': return conv.sent_messages_count ?? '-';
case 'received_messages_count': return conv.received_messages_count ?? '-';
case 'lead_score': return conv.contact?.lead_score ?? '-';
```

**Mapeamento de dados da query** — no `queryFn`, adicionar ao objeto conversation:
```typescript
first_response_at: row.first_response_at,
total_active_time_seconds: row.total_active_time_seconds,
sent_messages_count: row.sent_messages_count,
received_messages_count: row.received_messages_count,
contact: {
  ...
  lead_score: row.contact_lead_score,
}
```

**Correção visual do overflow:**
A `div` que envolve a tabela usa `overflow-x-auto` internamente. O problema é que o container pai tem `px-6` mas não define um `min-width` para o scroll funcionar corretamente. A correção é adicionar a classe `overflow-x-auto` no container externo e garantir que o `<table>` tenha `min-w-max` ou `table-fixed` para não compactar as colunas iniciais:

```jsx
// Antes:
<div className="overflow-x-auto">
  <table className="w-full text-sm">

// Depois:
<div className="overflow-x-auto">
  <table className="w-full min-w-[900px] text-sm">
```

---

## Arquivos a Modificar

1. **Nova migration SQL** — atualiza a função `search_conversations_report` para retornar os 5 novos campos.
2. **`src/pages/ConversationReport.tsx`** — adiciona as 5 novas colunas ao configurador + `getFieldValue` + mapeamento de dados + correção do overflow visual.

---

## Compatibilidade

- As 5 novas colunas chegam com `enabled: false` por padrão — usuários existentes não veem mudança até optarem por habilitá-las.
- O RPC é retrocompatível: todos os campos existentes permanecem no mesmo lugar.
- A correção do overflow é puramente visual e não afeta funcionalidade.
