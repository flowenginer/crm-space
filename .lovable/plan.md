
# Substituir "Relatório de Campanhas" por "WhatsApp Lead Tracking"

## O que muda

As rotas `/relatorios/campanhas` e `/relatorio-campanhas` atualmente renderizam `CampaignReport`. Elas passarao a renderizar `WhatsAppLeadTracking`. A rota dedicada `/whatsapp-lead-tracking` sera removida (redundante).

## Alteracoes

### 1. `src/App.tsx`

- Remover import de `CampaignReport`
- Remover a rota `/whatsapp-lead-tracking` (linha ~275)
- Nas rotas `/relatorios/campanhas` e `/relatorio-campanhas`, trocar `<CampaignReport />` por `<WhatsAppLeadTracking />`
- Ajustar a permission se necessario (de `marketing.view_campaigns` para `marketing.view` que e a usada pelo WhatsAppLeadTracking)

### 2. Arquivos que podem ser removidos (opcional)

Os seguintes arquivos ficam orfaos (nao usados por nenhuma rota):
- `src/pages/CampaignReport.tsx`
- `src/hooks/useCampaignReportData.ts`

Recomendacao: manter por enquanto caso queira reutilizar dados futuramente.

## Complexidade

Muito baixa - apenas alteracoes no arquivo de rotas.
