
## Correção: Data do Relatório de Atendimentos vindo com dia anterior

### Problema
Ao filtrar o relatório por "hoje" (ex: 23/02/2026), as datas são enviadas ao banco como `2026-02-23T00:00:00` e `2026-02-23T23:59:59` **sem fuso horário**. O PostgreSQL interpreta como UTC, mas o usuário está em BRT (UTC-3). Isso faz com que:
- Conversas criadas entre 00:00 e 02:59 BRT apareçam no dia anterior
- Conversas criadas entre 21:00 e 23:59 BRT não apareçam no dia correto

### Solução
Incluir o offset do fuso horário do navegador nas datas enviadas ao RPC, para que o PostgreSQL converta corretamente.

### Detalhes Técnicos

**Arquivo: `src/pages/ConversationReport.tsx`**

Alterar as linhas onde as datas são montadas para a chamada RPC (linhas ~346-347 e ~509-510), adicionando o offset do timezone local do navegador.

De:
```typescript
p_start_date: appliedFilters.startDate ? `${appliedFilters.startDate}T00:00:00` : null,
p_end_date: appliedFilters.endDate ? `${appliedFilters.endDate}T23:59:59` : null,
```

Para:
```typescript
p_start_date: appliedFilters.startDate 
  ? `${appliedFilters.startDate}T00:00:00${getTimezoneOffset()}` : null,
p_end_date: appliedFilters.endDate 
  ? `${appliedFilters.endDate}T23:59:59${getTimezoneOffset()}` : null,
```

Adicionar uma função utilitaria no mesmo arquivo:
```typescript
function getTimezoneOffset(): string {
  const offset = new Date().getTimezoneOffset();
  const sign = offset <= 0 ? '+' : '-';
  const hours = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0');
  const minutes = String(Math.abs(offset) % 60).padStart(2, '0');
  return `${sign}${hours}:${minutes}`;
}
```

Para o fuso BRT, isso geraria `2026-02-23T00:00:00-03:00`, fazendo com que o PostgreSQL entenda corretamente que "meia-noite" é no horário de Brasilia. A correção se aplica nos dois locais que chamam o RPC: a query principal e a exportacao Excel (select all).
