
# Plano: Reestruturar Dashboard para Exibir Trechos de Objeções

## Contexto
Os trechos das objeções avaliadas já estão sendo armazenados no banco de dados no campo `objecoes.{tipo}.trecho` com o formato `Cliente: 'mensagem' | Vendedor: 'resposta'`. Atualmente **249 de 489 avaliações** (51%) possuem trechos. A visualização atual mostra apenas frequência e nota média das objeções no gráfico de barras.

## Objetivo
Reestruturar a visualização do dashboard para permitir acesso e análise dos trechos de objeções de forma agregada, além do que já existe na sheet de detalhes individual.

---

## Arquitetura da Solução

```text
+------------------+     +----------------------+     +-------------------------+
|  ObjectionsBar   |     |  ObjectionDetail     |     |  ObjectionTrechos       |
|    Chart         | --> |     Modal            | --> |   (lista de exemplos)   |
| (clique na barra)|     | (stats + exemplos)   |     |   com chat preview      |
+------------------+     +----------------------+     +-------------------------+
```

---

## Etapas de Implementação

### Etapa 1: Atualizar Interface ObjectionAnalysis
**Arquivo:** `src/hooks/useSalesEvaluations.ts`

Adicionar campo `trechos` na interface para armazenar exemplos:
```typescript
export interface ObjectionAnalysis {
  name: string;
  frequency: number;
  avgScore: number;
  handledRate: number;
  // Novos campos:
  trechos: Array<{
    trecho: string;
    nota: number;
    tratada: boolean;
    evaluationId: string;
    conversationDate?: string;
  }>;
}
```

### Etapa 2: Atualizar Hook useObjectionsAnalysis
**Arquivo:** `src/hooks/useSalesEvaluations.ts`

Modificar a função para coletar os trechos junto com as estatísticas:
- Buscar também `id` e `conversation_last_message_at`
- Armazenar até 10 exemplos de trechos por tipo de objeção
- Priorizar trechos com notas extremas (muito boas ou muito ruins)

### Etapa 3: Criar ObjectionDetailModal
**Arquivo:** `src/components/sales-evaluation/ObjectionDetailModal.tsx`

Novo componente modal para exibir detalhes de uma objeção específica:
- Header com nome da objeção e estatísticas (frequência, nota média, taxa de tratamento)
- Gráfico de distribuição de notas
- Lista de exemplos de trechos com visualização estilo chat
- Indicador visual de tratada/não tratada e nota
- Botão para ver a conversa completa de cada exemplo

### Etapa 4: Atualizar ObjectionsBarChart
**Arquivo:** `src/components/sales-evaluation/ObjectionsBarChart.tsx`

Modificar para permitir interação:
- Adicionar `onClick` nas barras do gráfico
- Mostrar cursor de "pointer" no hover
- Passar callback `onSelectObjection` como prop

### Etapa 5: Atualizar SalesEvaluationDashboard
**Arquivo:** `src/pages/SalesEvaluationDashboard.tsx`

Integrar o novo modal:
- Adicionar estado para objeção selecionada
- Conectar callback do gráfico ao modal

---

## Detalhes Técnicos

### Estrutura do ObjectionDetailModal
```text
┌────────────────────────────────────────────────┐
│ 🛡️ Preço                            Nota: 5.2 │
│ ───────────────────────────────────────────── │
│ Frequência: 45x  |  Tratadas: 82%  |  ≥7: 38% │
├────────────────────────────────────────────────┤
│ 📊 Distribuição de Notas                       │
│ [=========] Bom (≥7): 17                       │
│ [======] Regular (5-7): 12                     │
│ [====] Fraco (3-5): 10                         │
│ [==] Crítico (<3): 6                           │
├────────────────────────────────────────────────┤
│ 💬 Exemplos de Trechos                         │
│                                                │
│ ┌──────────────────────────────────┐           │
│ │ 👤 Cliente:                      │           │
│ │ "Tá muito caro, não tenho grana" │           │
│ └──────────────────────────────────┘           │
│            ┌──────────────────────────────┐    │
│            │ 🎧 Vendedor:                 │    │
│            │ "Entendo! Temos condições    │    │
│            │ especiais de parcelamento.." │    │
│            └──────────────────────────────┘    │
│ ✅ Tratada  |  Nota: 8.0  |  📅 28/01/2026    │
│ ─────────────────────────────────────────────  │
│ [Ver conversa completa]                        │
├────────────────────────────────────────────────┤
│                               [Fechar]         │
└────────────────────────────────────────────────┘
```

### Priorização dos Exemplos
Para cada tipo de objeção, coletar até 10 exemplos priorizando:
1. Exemplos com nota ≥8 (melhores práticas)
2. Exemplos com nota ≤3 (oportunidades de treinamento)
3. Exemplos mais recentes

### Performance
- Limitar a 10 trechos por tipo de objeção para não sobrecarregar
- Buscar trechos apenas quando o modal for aberto (lazy loading) - opcional
- Usar memo para evitar recálculos desnecessários

---

## Arquivos Modificados

| Arquivo | Ação |
|---------|------|
| `src/hooks/useSalesEvaluations.ts` | Atualizar interface e hook |
| `src/components/sales-evaluation/ObjectionDetailModal.tsx` | Criar novo componente |
| `src/components/sales-evaluation/ObjectionsBarChart.tsx` | Adicionar interatividade |
| `src/pages/SalesEvaluationDashboard.tsx` | Integrar modal |

---

## Resultado Final
- Dashboard permite clicar em qualquer objeção no gráfico
- Modal exibe estatísticas detalhadas da objeção
- Exemplos de trechos reais são exibidos com formato de chat
- Permite identificar melhores práticas e oportunidades de treinamento
- Acesso rápido à conversa completa de cada exemplo
