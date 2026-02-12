
# Adicionar Linktree e WhatsApp ao grafico "Distribuicao por Origem"

## O que sera feito
O grafico de pizza "Distribuicao por Origem" atualmente mostra apenas 2 fatias: **CTWA Ads** e **Redirect**. Vamos separar e adicionar duas novas origens:

1. **Linktree** - Leads que hoje estao agrupados junto com Redirect (207 conversas com referral_source = 'linktree')
2. **WhatsApp** - Leads organicos que chegaram diretamente pelo WhatsApp sem anuncio (2042 contatos com origin = 'whatsapp')

## Resultado esperado
O grafico passara a ter ate 4 fatias com cores distintas:
- CTWA Ads (azul)
- Redirect (laranja)
- Linktree (verde)
- WhatsApp (roxo)

## Detalhes tecnicos

### 1. Hook `useWhatsAppLeadTracking.ts`

**Separar Linktree do Redirect**: Atualmente `referralSource === 'linktree'` e agrupado como `isRedirect`. Vamos criar uma terceira categoria `linktreeLeads` separada.

**Adicionar WhatsApp organico**: Incluir uma query adicional para buscar conversas onde o contato tem `origin = 'whatsapp'` e nao tem `referral_source` (leads organicos). Criar categoria `whatsappLeads`.

**Atualizar interfaces**:
- `LeadTrackingSummary`: adicionar campos `linktreeLeads` e `whatsappLeads`
- `CreativeBreakdown.source_type`: expandir para incluir `'linktree' | 'whatsapp'`
- `emptySummary()`: incluir os novos campos

### 2. Pagina `WhatsAppLeadTracking.tsx`

**Grafico de pizza (`pieData`)**: Adicionar duas novas entradas condicionais para Linktree (verde #22c55e) e WhatsApp (roxo #8b5cf6).

**Stat Cards**: Adicionar cards para "Leads Linktree" e "Leads WhatsApp" com icones e cores distintas.

**Summary default**: Atualizar o valor padrao do summary para incluir os novos campos com 0.
