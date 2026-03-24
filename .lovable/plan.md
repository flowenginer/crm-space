

## Plano: Adicionar colunas "Hora Chegada" e "Hora 1ª Resposta" no Relatório

### O que já existe
O RPC `search_conversations_report` já retorna:
- `created_at` — momento em que o lead chegou
- `first_response_at` — momento em que o atendente respondeu pela primeira vez

Porém no frontend, `created_at` é exibido como "Data Abertura" (só data) e `first_response_at` é usado apenas para calcular "Tempo 1º Atendimento" (diferença em minutos). **Não existem colunas mostrando os horários exatos.**

### Alteração

**Arquivo único:** `src/pages/ConversationReport.tsx`

1. **Adicionar 2 novas colunas** no `DEFAULT_COLUMNS` (após `closed_at`):
   - `{ key: 'arrival_time', label: 'Hora Chegada', enabled: true }`
   - `{ key: 'first_response_datetime', label: 'Hora 1ª Resposta', enabled: true }`

2. **Adicionar renderização** no switch de colunas:
   - `arrival_time`: formata `conv.created_at` com data + hora (dd/MM/yyyy HH:mm)
   - `first_response_datetime`: formata `conv.first_response_at` com data + hora, ou "-" se não houver

3. **Adicionar no export Excel**: incluir essas duas colunas formatadas na exportação

Nenhuma alteração no banco de dados é necessária — os dados já vêm do RPC.

