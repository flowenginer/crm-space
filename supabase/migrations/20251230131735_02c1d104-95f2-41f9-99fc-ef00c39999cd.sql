-- =====================================================
-- OTIMIZAÇÃO DE PERFORMANCE: Índices para tabelas de redirect
-- =====================================================

-- Índices para redirect_campaigns
CREATE INDEX IF NOT EXISTS idx_redirect_campaigns_tenant_id 
  ON public.redirect_campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_redirect_campaigns_tenant_active 
  ON public.redirect_campaigns(tenant_id, is_active);

-- Índices para redirect_campaign_channels  
CREATE INDEX IF NOT EXISTS idx_redirect_campaign_channels_tenant_id 
  ON public.redirect_campaign_channels(tenant_id);
CREATE INDEX IF NOT EXISTS idx_redirect_campaign_channels_campaign_id 
  ON public.redirect_campaign_channels(campaign_id);

-- Índices para redirect_ab_tests
CREATE INDEX IF NOT EXISTS idx_redirect_ab_tests_tenant_id 
  ON public.redirect_ab_tests(tenant_id);

-- Índices para redirect_ab_test_variants
CREATE INDEX IF NOT EXISTS idx_redirect_ab_test_variants_tenant_id 
  ON public.redirect_ab_test_variants(tenant_id);
CREATE INDEX IF NOT EXISTS idx_redirect_ab_test_variants_ab_test_id 
  ON public.redirect_ab_test_variants(ab_test_id);

-- Índices para redirect_campaign_views (alto volume de inserts)
CREATE INDEX IF NOT EXISTS idx_redirect_campaign_views_campaign_id 
  ON public.redirect_campaign_views(campaign_id);
CREATE INDEX IF NOT EXISTS idx_redirect_campaign_views_tenant_id 
  ON public.redirect_campaign_views(tenant_id);

-- =====================================================
-- CORREÇÃO RLS: redirect_campaign_views
-- =====================================================

-- Remover política antiga que permite qualquer insert
DROP POLICY IF EXISTS "Public insert views" ON public.redirect_campaign_views;

-- Nova política que exige tenant_id e campanha ativa
CREATE POLICY "Public insert views with valid tenant" 
  ON public.redirect_campaign_views FOR INSERT
  WITH CHECK (
    tenant_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM public.redirect_campaigns rc 
      WHERE rc.id = campaign_id AND rc.is_active = true
    )
  );