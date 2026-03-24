

## Plano: Filtro de Agentes por Canal no Relatório

### Problema
Quando se filtra por canal "Master Leads", aparecem agentes como "Rainy" que pertencem ao canal "Emprega Mais". Isso acontece porque a Rainy foi atribuída a conversas no canal Master Leads (antes da restrição ou via transferência). O dado é tecnicamente correto, mas operacionalmente confuso.

### Solução Proposta
Duas melhorias complementares:

#### 1. Filtro de Agentes contextual por canal selecionado
**Arquivo:** `src/pages/ConversationReport.tsx`

Quando um canal é selecionado no filtro, o dropdown de **Agentes** passa a mostrar apenas agentes que possuem conversas naquele canal (em vez de listar todos os agentes do tenant). Isso é feito filtrando os agentes disponíveis com base nos dados já retornados ou com uma query auxiliar.

#### 2. Filtro de Agentes por `user_channels` (opcional, mais restritivo)
Alternativamente, filtrar o dropdown de agentes com base na tabela `user_channels` — só mostra agentes que estão configurados para aquele canal. Isso impediria ver dados de agentes "intrusos" mesmo que tenham atendido leads no canal.

### Recomendação
A opção 1 é mais pragmática: mostra apenas agentes que realmente têm conversas no canal filtrado, sem esconder dados históricos. A opção 2 é mais restritiva mas pode ocultar dados válidos.

### Alteração Técnica (Opção 1)
**Arquivo único:** `src/pages/ConversationReport.tsx`
- No carregamento da lista de agentes para o dropdown, quando `selectedChannels` contiver um canal, fazer uma query para buscar apenas `assigned_to` distintos das conversas daquele canal
- Isso faz o dropdown de agentes ficar contextual ao canal selecionado

