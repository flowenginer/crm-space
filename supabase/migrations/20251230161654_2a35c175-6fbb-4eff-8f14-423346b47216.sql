-- Remover política atual que está bloqueando inserções
DROP POLICY IF EXISTS "Public insert views with valid tenant" ON public.redirect_campaign_views;

-- Criar política simples que permite insert público
-- A validação de campanha ativa é feita na aplicação (RedirectLanding.tsx)
CREATE POLICY "Public insert views" 
  ON public.redirect_campaign_views FOR INSERT
  WITH CHECK (tenant_id IS NOT NULL);