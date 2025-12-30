-- Adicionar campos de rastreamento/pixels nas campanhas de redirect
ALTER TABLE redirect_campaigns 
ADD COLUMN facebook_pixel_id text,
ADD COLUMN gtm_container_id text,
ADD COLUMN google_analytics_id text;

COMMENT ON COLUMN redirect_campaigns.facebook_pixel_id IS 'ID do Pixel do Facebook/Meta (ex: 123456789)';
COMMENT ON COLUMN redirect_campaigns.gtm_container_id IS 'ID do container GTM (ex: GTM-XXXXXX)';
COMMENT ON COLUMN redirect_campaigns.google_analytics_id IS 'ID do Google Analytics 4 (ex: G-XXXXXXXXXX)';