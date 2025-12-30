-- Tabela para contar TODOS os pageviews (cada acesso)
CREATE TABLE public.redirect_campaign_pageviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.redirect_campaigns(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_redirect_pageviews_campaign ON public.redirect_campaign_pageviews(campaign_id);
CREATE INDEX idx_redirect_pageviews_created ON public.redirect_campaign_pageviews(created_at);

-- RLS
ALTER TABLE public.redirect_campaign_pageviews ENABLE ROW LEVEL SECURITY;

-- Política para inserção anônima (landing pages públicas)
CREATE POLICY "Allow anonymous pageview insert"
  ON public.redirect_campaign_pageviews FOR INSERT
  TO anon
  WITH CHECK (tenant_id IS NOT NULL);

-- Política para leitura por tenant autenticado
CREATE POLICY "Tenant can view own pageviews"
  ON public.redirect_campaign_pageviews FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id());