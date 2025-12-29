-- Tabela principal de campanhas de redirect
CREATE TABLE public.redirect_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Identificação
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  
  -- Personalização
  logo_url TEXT,
  title TEXT DEFAULT 'Fale com nosso time!',
  subtitle TEXT,
  button_text TEXT DEFAULT 'Falar com Vendedor',
  button_color TEXT DEFAULT '#8B5CF6',
  background_color TEXT DEFAULT '#FFFFFF',
  
  -- Mensagem de boas-vindas no WhatsApp
  welcome_message TEXT DEFAULT 'Olá! Vi seu anúncio e gostaria de mais informações.',
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Estatísticas
  total_clicks INTEGER DEFAULT 0,
  total_leads INTEGER DEFAULT 0,
  
  -- Round-robin counter
  current_channel_index INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(tenant_id, slug)
);

-- Canais vinculados à campanha
CREATE TABLE public.redirect_campaign_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES redirect_campaigns(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES whatsapp_channels(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  position INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(campaign_id, channel_id)
);

-- Log de cliques/leads
CREATE TABLE public.redirect_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES redirect_campaigns(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  contact_id UUID REFERENCES contacts(id),
  channel_id UUID REFERENCES whatsapp_channels(id),
  
  -- Dados capturados
  phone TEXT NOT NULL,
  country_code TEXT DEFAULT '55',
  
  -- UTMs
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,
  
  -- Metadata
  ip_address TEXT,
  user_agent TEXT,
  referrer TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.redirect_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redirect_campaign_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redirect_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for redirect_campaigns
CREATE POLICY "Tenant isolation for redirect_campaigns"
  ON public.redirect_campaigns FOR ALL
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Authenticated access redirect_campaigns"
  ON public.redirect_campaigns FOR ALL
  USING (auth.uid() IS NOT NULL);

-- RLS Policies for redirect_campaign_channels
CREATE POLICY "Tenant isolation for redirect_campaign_channels"
  ON public.redirect_campaign_channels FOR ALL
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Authenticated access redirect_campaign_channels"
  ON public.redirect_campaign_channels FOR ALL
  USING (auth.uid() IS NOT NULL);

-- RLS Policies for redirect_logs
CREATE POLICY "Tenant isolation for redirect_logs"
  ON public.redirect_logs FOR ALL
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Authenticated access redirect_logs"
  ON public.redirect_logs FOR ALL
  USING (auth.uid() IS NOT NULL);

-- Trigger para updated_at
CREATE TRIGGER update_redirect_campaigns_updated_at
  BEFORE UPDATE ON public.redirect_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Adicionar menu item para todos os tenants
INSERT INTO menu_items (tenant_id, title, href, icon, position, is_active)
SELECT 
  id as tenant_id,
  'Redirect' as title,
  '/redirect' as href,
  'ExternalLink' as icon,
  12 as position,
  true as is_active
FROM tenants
ON CONFLICT DO NOTHING;