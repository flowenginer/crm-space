

## Corrigir Bug na Distribuicao Automatica por Percentual

### Problema Identificado

Analisei a edge function `distribute-lead/index.ts` e encontrei **3 bugs criticos** no algoritmo de distribuicao por percentual (linhas 256-301):

### Bug 1: Algoritmo de selecao matematicamente quebrado

O codigo tenta encontrar o agente com maior "deficit" entre o percentual configurado e o percentual real recebido, mas a logica de comparacao esta incorreta:

```text
// Codigo atual (bugado):
const deficit = targetRatio - currentRatio;
if (deficit > lowestRatio * -1 || !bestAgent) {
  if (deficit > 0 || bestAgent === null) {
    bestAgent = agent;
    lowestRatio = currentRatio - targetRatio;
  }
}
```

Quando `leads_received` esta zerado para todos, o deficit de cada agente equivale ao seu percentual configurado (40, 40, 20). A comparacao `deficit > lowestRatio * -1` faz com que apenas o **primeiro agente da lista** seja selecionado repetidamente, pois o segundo agente com deficit igual nao passa na condicao `40 > 40` (falso).

### Bug 2: Contador `leads_received` sempre reseta para 0

Os dados atuais na tabela `company_settings` mostram que **todos os agentes estao com `leads_received: 0`**, apesar de centenas de leads terem sido distribuidos. Isso ocorre porque:
- Cada invocacao da function le os contadores do banco
- Se duas distribuicoes acontecem simultaneamente (ou quase), ambas leem `leads_received: 0` e gravam `leads_received: 1`, perdendo uma contagem
- Qualquer edicao na tela de configuracao de distribuicao provavelmente sobrescreve os contadores com 0

### Bug 3: Agentes offline eliminam o balanceamento

Quando Rainy e Nadia ficam offline (`is_available: false`), apenas Beatriz permanece no pool. Os leads vao 100% para ela, e o contador nao compensa quando as outras voltam. Os dados confirmam isso: nos dias 17 e 18/02, a distribuicao enviou leads para Beatriz, Bruna e Susana - **nenhum para Rainy ou Nadia**, indicando que estavam indisponiveis.

### Solucao Proposta

Substituir o algoritmo quebrado por **distribuicao ponderada por peso (weighted random)** que:
1. Nao depende de contadores persistentes (elimina race conditions)
2. Funciona corretamente mesmo com agentes entrando/saindo do pool
3. Respeita os percentuais configurados estatisticamente ao longo do tempo

### Secao Tecnica

**Arquivo**: `supabase/functions/distribute-lead/index.ts`

**Mudanca principal** (linhas 256-301): Substituir todo o bloco de selecao por percentual por:

```text
// Weighted random selection based on configured percentages
// 1. Filter active configured agents in pool
// 2. Normalize percentages (so they sum to 100% among available agents)
// 3. Generate random number and select agent based on cumulative weights

function selectByPercentage(agents, agentPool) {
  // Filter to only available configured agents
  const eligible = agents
    .filter(a => a.is_active && agentPool.some(p => p.id === a.user_id))

  if (eligible.length === 0) return null;
  if (eligible.length === 1) return eligible[0];

  // Normalize percentages among available agents
  const totalPercentage = eligible.reduce((sum, a) => sum + a.percentage, 0);
  const random = Math.random() * totalPercentage;

  let cumulative = 0;
  for (const agent of eligible) {
    cumulative += agent.percentage;
    if (random <= cumulative) return agent;
  }
  return eligible[eligible.length - 1]; // fallback
}
```

**Vantagens**:
- Se Beatriz tem 20% e as outras 40% cada, a cada lead ha 20% de chance de ir para Beatriz e 40% para cada uma das outras
- Se Rainy fica offline, os percentuais se renormalizam automaticamente: Nadia (40/60 = 67%) e Beatriz (20/60 = 33%)
- Zero dependencia de contadores, zero race conditions
- Ainda atualiza `leads_received` para fins de monitoramento/relatorio, mas nao usa para decisao

**Tambem sera feito**:
- Resetar os contadores `leads_received` atuais no banco para refletir a realidade
- Atualizar a versao da function para rastreabilidade

