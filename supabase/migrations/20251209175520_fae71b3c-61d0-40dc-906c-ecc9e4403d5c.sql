-- Create meta_ads table to store individual ad details
CREATE TABLE public.meta_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_account_id UUID REFERENCES meta_ad_accounts(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES meta_campaigns(id) ON DELETE CASCADE,
  adset_id UUID REFERENCES meta_adsets(id) ON DELETE SET NULL,
  ad_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT,
  creative_id TEXT,
  thumbnail_url TEXT,
  preview_url TEXT,
  created_time TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(meta_account_id, ad_id)
);

-- Enable RLS
ALTER TABLE public.meta_ads ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Authenticated users can view meta_ads"
ON public.meta_ads FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert meta_ads"
ON public.meta_ads FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update meta_ads"
ON public.meta_ads FOR UPDATE
TO authenticated
USING (true);

-- Create indexes for performance
CREATE INDEX idx_meta_ads_ad_id ON public.meta_ads(ad_id);
CREATE INDEX idx_meta_ads_campaign ON public.meta_ads(campaign_id);
CREATE INDEX idx_meta_ads_account ON public.meta_ads(meta_account_id);