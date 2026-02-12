
# Top 5 Criativos por Conversao e Conversao no Grafico de Jornada

## Objetivo

Adicionar dois recursos na aba "Graficos" do WhatsApp Lead Tracking:

1. **Novo card: "Top 5 Criativos que mais Converteram"** - Ranking dos criativos com mais conversoes (vendas), baseado no campo `custom_fields.conversoes` dos contatos.
2. **Nova barra no grafico "Jornada do Lead por Criativo"** - Adicionar uma barra/segmento "Conversao" (baseada no campo `custom_fields.conversoes`) ao grafico de barras empilhadas existente.

## Como funciona

- Cada contato pode ter um array de conversoes em `custom_fields.conversoes`
- Se o array existe e tem pelo menos 1 item, o contato "converteu"
- O sistema cruza: criativo vinculado ao lead x contato com conversao registrada
- O Top 5 mostra os criativos ordenados por quantidade de contatos que converteram, incluindo o valor total acumulado

## Detalhes Tecnicos

### 1. Hook: `src/hooks/useWhatsAppLeadTracking.ts`

- Adicionar `custom_fields` ao select da query de contacts (linha 133)
- Adicionar campo `has_conversion` (boolean) e `conversion_total` (number) ao tipo `TrackedLead`
- Preencher esses campos verificando se `contact.custom_fields?.conversoes` e um array com itens

### 2. Pagina: `src/pages/WhatsAppLeadTracking.tsx`

**Novo card "Top 5 Criativos por Conversao":**
- Posicionar na aba "charts", no lugar do card "Leads sem Criativo Vinculado" (que sera movido para baixo ou colocado ao lado)
- Agrupar leads por `creative_name`, contar quantos tem `has_conversion = true` e somar `conversion_total`
- Exibir como lista rankeada com nome do criativo, quantidade de conversoes e valor total
- Usar icones de trofeu/medal para os top 3

**Grafico "Jornada do Lead por Criativo":**
- Adicionar um status sintetico "Conversao" ao array de statuses quando houver leads com conversao
- Esse status tera uma cor verde destacada (ex: #22c55e)
- Sera contabilizado independentemente do status atual do lead -- se tem `has_conversion`, conta como "Conversao" naquele criativo

### Arquivos modificados

1. `src/hooks/useWhatsAppLeadTracking.ts` - Adicionar `custom_fields` na query e campos de conversao no TrackedLead
2. `src/pages/WhatsAppLeadTracking.tsx` - Novo card de Top 5 e barra de conversao no grafico de jornada
