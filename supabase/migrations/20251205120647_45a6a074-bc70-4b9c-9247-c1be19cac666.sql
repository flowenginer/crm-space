-- Tabela para armazenar conexões com contas Meta Ads
CREATE TABLE public.meta_ad_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL,
  account_name TEXT,
  access_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  refresh_token TEXT,
  business_id TEXT,
  currency TEXT DEFAULT 'BRL',
  timezone TEXT DEFAULT 'America/Sao_Paulo',
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(account_id)
);

-- Tabela para campanhas sincronizadas
CREATE TABLE public.meta_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_account_id UUID REFERENCES public.meta_ad_accounts(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL,
  name TEXT NOT NULL,
  objective TEXT,
  status TEXT,
  daily_budget DECIMAL(12,2),
  lifetime_budget DECIMAL(12,2),
  start_time TIMESTAMPTZ,
  stop_time TIMESTAMPTZ,
  created_time TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(meta_account_id, campaign_id)
);

-- Tabela para ad sets
CREATE TABLE public.meta_adsets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_account_id UUID REFERENCES public.meta_ad_accounts(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.meta_campaigns(id) ON DELETE CASCADE,
  adset_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT,
  daily_budget DECIMAL(12,2),
  lifetime_budget DECIMAL(12,2),
  targeting JSONB,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(meta_account_id, adset_id)
);

-- Tabela para métricas/insights
CREATE TABLE public.meta_campaign_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.meta_campaigns(id) ON DELETE CASCADE,
  date_start DATE NOT NULL,
  date_stop DATE NOT NULL,
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  spend DECIMAL(12,2) DEFAULT 0,
  reach BIGINT DEFAULT 0,
  ctr DECIMAL(8,4),
  cpc DECIMAL(12,4),
  cpm DECIMAL(12,4),
  conversions BIGINT DEFAULT 0,
  cost_per_conversion DECIMAL(12,4),
  actions JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(campaign_id, date_start)
);

-- Enable RLS
ALTER TABLE public.meta_ad_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_adsets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_campaign_insights ENABLE ROW LEVEL SECURITY;

-- Policies for meta_ad_accounts
CREATE POLICY "Users can view own meta accounts" ON public.meta_ad_accounts
  FOR SELECT USING (auth.uid() = user_id OR is_admin(auth.uid()));

CREATE POLICY "Users can insert own meta accounts" ON public.meta_ad_accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own meta accounts" ON public.meta_ad_accounts
  FOR UPDATE USING (auth.uid() = user_id OR is_admin(auth.uid()));

CREATE POLICY "Users can delete own meta accounts" ON public.meta_ad_accounts
  FOR DELETE USING (auth.uid() = user_id OR is_admin(auth.uid()));

-- Policies for meta_campaigns (based on account ownership)
CREATE POLICY "Authenticated access meta_campaigns" ON public.meta_campaigns
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Policies for meta_adsets
CREATE POLICY "Authenticated access meta_adsets" ON public.meta_adsets
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Policies for meta_campaign_insights
CREATE POLICY "Authenticated access meta_campaign_insights" ON public.meta_campaign_insights
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Índices para performance
CREATE INDEX idx_meta_campaigns_account ON public.meta_campaigns(meta_account_id);
CREATE INDEX idx_meta_campaigns_status ON public.meta_campaigns(status);
CREATE INDEX idx_meta_adsets_campaign ON public.meta_adsets(campaign_id);
CREATE INDEX idx_meta_insights_campaign ON public.meta_campaign_insights(campaign_id);
CREATE INDEX idx_meta_insights_date ON public.meta_campaign_insights(date_start);

-- Trigger para updated_at
CREATE TRIGGER update_meta_ad_accounts_updated_at
  BEFORE UPDATE ON public.meta_ad_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_meta_campaigns_updated_at
  BEFORE UPDATE ON public.meta_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_meta_adsets_updated_at
  BEFORE UPDATE ON public.meta_adsets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();