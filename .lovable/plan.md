

# Corrigir Linktree no grafico e adicionar Manual

## Problema
Os contatos Linktree (769) nao estao aparecendo como fatia separada no grafico. Isso acontece porque esses contatos tem `origin = 'linktree'` no contato, mas nao tem `referral_source = 'linktree'` na conversa. Eles estao sendo capturados pela query de "WhatsApp organico" e contados como WhatsApp.

Alem disso, existem 1106 contatos com `origin = 'manual'` que tambem precisam aparecer no grafico.

## Solucao

### 1. Hook `useWhatsAppLeadTracking.ts`

**Separar Linktree do WhatsApp organico**: Na secao que processa leads organicos (linha ~308-345), ao inves de agrupar todos como `whatsapp`, verificar `contact.origin`:
- Se `origin = 'linktree'` -> adicionar a `linktreeLeads` com `source_type: 'linktree'`
- Se `origin = 'whatsapp'` -> manter como `whatsappLeads`

**Adicionar Manual**: Expandir a query organica para incluir `origin = 'manual'`. Criar nova categoria `manualLeads` com `source_type: 'manual'`.

**Atualizar tipos**:
- `TrackedLead.source_type`: adicionar `'manual'`
- `CreativeBreakdown.source_type`: adicionar `'manual'`
- `LeadTrackingSummary`: adicionar `manualLeads`
- `emptySummary()`: incluir `manualLeads: 0`

### 2. Pagina `WhatsAppLeadTracking.tsx`

**Grafico de pizza**: Adicionar fatia "Manual" com cor distinta (rosa `#ec4899`).

**Stat Cards**: Adicionar card "Leads Manual".

**SourceBadge**: Adicionar badge para tipo `'manual'`.

**Summary default**: Incluir `manualLeads: 0`.

## Resultado esperado
O grafico tera ate 5 fatias: CTWA Ads, Redirect, Linktree, WhatsApp e Manual, cada uma com sua cor e contagem corretas.
