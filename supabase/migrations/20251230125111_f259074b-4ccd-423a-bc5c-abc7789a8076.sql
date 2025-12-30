-- Tabela principal de Testes A/B
CREATE TABLE public.redirect_ab_tests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  distribution_type TEXT NOT NULL DEFAULT 'equal', -- 'equal' ou 'weighted'
  total_views INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, slug)
);

-- Tabela de variantes do Teste A/B
CREATE TABLE public.redirect_ab_test_variants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ab_test_id UUID NOT NULL REFERENCES public.redirect_ab_tests(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.redirect_campaigns(id) ON DELETE CASCADE,
  weight INTEGER NOT NULL DEFAULT 50, -- Peso em porcentagem
  views_count INTEGER NOT NULL DEFAULT 0,
  leads_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  UNIQUE(ab_test_id, campaign_id)
);

-- Enable RLS
ALTER TABLE public.redirect_ab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redirect_ab_test_variants ENABLE ROW LEVEL SECURITY;

-- Policies para redirect_ab_tests
CREATE POLICY "Users can view their tenant ab tests"
  ON public.redirect_ab_tests FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can create ab tests for their tenant"
  ON public.redirect_ab_tests FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update their tenant ab tests"
  ON public.redirect_ab_tests FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete their tenant ab tests"
  ON public.redirect_ab_tests FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- Policies para redirect_ab_test_variants
CREATE POLICY "Users can view their tenant ab test variants"
  ON public.redirect_ab_test_variants FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can create ab test variants for their tenant"
  ON public.redirect_ab_test_variants FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update their tenant ab test variants"
  ON public.redirect_ab_test_variants FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete their tenant ab test variants"
  ON public.redirect_ab_test_variants FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- Policy pública para landing page (acesso sem autenticação)
CREATE POLICY "Public can view active ab tests by slug"
  ON public.redirect_ab_tests FOR SELECT
  USING (is_active = true);

CREATE POLICY "Public can view variants of active ab tests"
  ON public.redirect_ab_test_variants FOR SELECT
  USING (ab_test_id IN (SELECT id FROM public.redirect_ab_tests WHERE is_active = true));

-- Trigger para updated_at
CREATE TRIGGER update_redirect_ab_tests_updated_at
  BEFORE UPDATE ON public.redirect_ab_tests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_redirect_ab_tests_tenant_id ON public.redirect_ab_tests(tenant_id);
CREATE INDEX idx_redirect_ab_tests_slug ON public.redirect_ab_tests(slug);
CREATE INDEX idx_redirect_ab_test_variants_ab_test_id ON public.redirect_ab_test_variants(ab_test_id);
CREATE INDEX idx_redirect_ab_test_variants_campaign_id ON public.redirect_ab_test_variants(campaign_id);