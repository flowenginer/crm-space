
# Criar pagina de Criativos por Conversao

## O que sera feito
Adicionar uma nova aba **"Conversoes"** no WhatsApp Lead Tracking (ao lado de Criativos, Graficos, Leads e Data Cross) dedicada exclusivamente a mostrar **todos** os criativos que geraram conversoes, com dados completos de faturamento.

## Resultado esperado
Uma nova aba com:
- **KPI Cards** no topo: Total de Conversoes, Faturamento Total, Ticket Medio, Criativos com Conversao
- **Tabela completa** com todos os criativos que geraram conversao, incluindo: Nome do Criativo, Conjunto de Anuncio, Campanha, Quantidade de Conversoes, Faturamento Total, Ticket Medio
- **Ranking visual** com icones de trofeu para os 3 primeiros
- Ordenacao por qualquer coluna (conversoes ou faturamento)
- Busca por nome de criativo

## Detalhes tecnicos

### Arquivo: `src/pages/WhatsAppLeadTracking.tsx`

**1. Expandir as tabs** (linha 639): Adicionar `grid-cols-5` e nova tab "Conversoes" com icone `ShoppingBag`.

**2. Criar novo `useMemo`** para calcular todos os criativos com conversao (similar ao `top5ConversionCreatives` existente na linha 318, mas sem o `.slice(0, 5)` e com dados adicionais de adset/campanha):

```text
allConversionCreatives = leads com has_conversion agrupados por creative_name
  -> para cada: count, total, adset_name, campaign_name, ticket medio
  -> ordenados por count DESC
```

**3. Adicionar novo `TabsContent value="conversions"`** com:
- 4 KPI cards (total conversoes, faturamento, ticket medio, criativos unicos)
- Tabela completa com todas as colunas e ordenacao
- Campo de busca para filtrar criativos

Nenhuma alteracao no hook `useWhatsAppLeadTracking.ts` -- todos os dados necessarios (`has_conversion`, `conversion_total`, `creative_name`, `adset_name`, `campaign_name`) ja existem no `TrackedLead`.
