-- Create marketing_campaigns table
CREATE TABLE public.marketing_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  tenant_id UUID NOT NULL DEFAULT (((current_setting('request.jwt.claims'::text, true))::json ->> 'tenant_id'::text))::uuid REFERENCES public.tenants(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create active_marketing_campaigns table
CREATE TABLE public.active_marketing_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  current_step INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'responded', 'completed', 'cancelled')),
  next_send_at TIMESTAMP WITH TIME ZONE,
  dispatch_id UUID REFERENCES public.bulk_dispatches(id) ON DELETE SET NULL,
  tenant_id UUID NOT NULL DEFAULT (((current_setting('request.jwt.claims'::text, true))::json ->> 'tenant_id'::text))::uuid REFERENCES public.tenants(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  responded_at TIMESTAMP WITH TIME ZONE
);

-- Create marketing_scheduled_messages table
CREATE TABLE public.marketing_scheduled_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  active_campaign_id UUID NOT NULL REFERENCES public.active_marketing_campaigns(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  content TEXT NOT NULL,
  audio_url TEXT,
  attachment_url TEXT,
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'cancelled')),
  tenant_id UUID NOT NULL DEFAULT (((current_setting('request.jwt.claims'::text, true))::json ->> 'tenant_id'::text))::uuid REFERENCES public.tenants(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add campaign_type to bulk_dispatches
ALTER TABLE public.bulk_dispatches 
ADD COLUMN IF NOT EXISTS campaign_type TEXT DEFAULT 'followup' CHECK (campaign_type IN ('followup', 'marketing'));

-- Add marketing_campaign_id to bulk_dispatches
ALTER TABLE public.bulk_dispatches 
ADD COLUMN IF NOT EXISTS marketing_campaign_id UUID REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.active_marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_scheduled_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for marketing_campaigns
CREATE POLICY "Users can view marketing campaigns from their tenant"
ON public.marketing_campaigns FOR SELECT
USING (tenant_id = (((current_setting('request.jwt.claims'::text, true))::json ->> 'tenant_id'::text))::uuid);

CREATE POLICY "Users can create marketing campaigns in their tenant"
ON public.marketing_campaigns FOR INSERT
WITH CHECK (tenant_id = (((current_setting('request.jwt.claims'::text, true))::json ->> 'tenant_id'::text))::uuid);

CREATE POLICY "Users can update marketing campaigns in their tenant"
ON public.marketing_campaigns FOR UPDATE
USING (tenant_id = (((current_setting('request.jwt.claims'::text, true))::json ->> 'tenant_id'::text))::uuid);

CREATE POLICY "Users can delete marketing campaigns in their tenant"
ON public.marketing_campaigns FOR DELETE
USING (tenant_id = (((current_setting('request.jwt.claims'::text, true))::json ->> 'tenant_id'::text))::uuid);

-- RLS Policies for active_marketing_campaigns
CREATE POLICY "Users can view active marketing campaigns from their tenant"
ON public.active_marketing_campaigns FOR SELECT
USING (tenant_id = (((current_setting('request.jwt.claims'::text, true))::json ->> 'tenant_id'::text))::uuid);

CREATE POLICY "Users can create active marketing campaigns in their tenant"
ON public.active_marketing_campaigns FOR INSERT
WITH CHECK (tenant_id = (((current_setting('request.jwt.claims'::text, true))::json ->> 'tenant_id'::text))::uuid);

CREATE POLICY "Users can update active marketing campaigns in their tenant"
ON public.active_marketing_campaigns FOR UPDATE
USING (tenant_id = (((current_setting('request.jwt.claims'::text, true))::json ->> 'tenant_id'::text))::uuid);

CREATE POLICY "Users can delete active marketing campaigns in their tenant"
ON public.active_marketing_campaigns FOR DELETE
USING (tenant_id = (((current_setting('request.jwt.claims'::text, true))::json ->> 'tenant_id'::text))::uuid);

-- RLS Policies for marketing_scheduled_messages
CREATE POLICY "Users can view scheduled messages from their tenant"
ON public.marketing_scheduled_messages FOR SELECT
USING (tenant_id = (((current_setting('request.jwt.claims'::text, true))::json ->> 'tenant_id'::text))::uuid);

CREATE POLICY "Users can create scheduled messages in their tenant"
ON public.marketing_scheduled_messages FOR INSERT
WITH CHECK (tenant_id = (((current_setting('request.jwt.claims'::text, true))::json ->> 'tenant_id'::text))::uuid);

CREATE POLICY "Users can update scheduled messages in their tenant"
ON public.marketing_scheduled_messages FOR UPDATE
USING (tenant_id = (((current_setting('request.jwt.claims'::text, true))::json ->> 'tenant_id'::text))::uuid);

CREATE POLICY "Users can delete scheduled messages in their tenant"
ON public.marketing_scheduled_messages FOR DELETE
USING (tenant_id = (((current_setting('request.jwt.claims'::text, true))::json ->> 'tenant_id'::text))::uuid);

-- Indexes for performance
CREATE INDEX idx_marketing_campaigns_tenant ON public.marketing_campaigns(tenant_id);
CREATE INDEX idx_marketing_campaigns_active ON public.marketing_campaigns(tenant_id, is_active);
CREATE INDEX idx_active_marketing_campaigns_tenant ON public.active_marketing_campaigns(tenant_id);
CREATE INDEX idx_active_marketing_campaigns_status ON public.active_marketing_campaigns(tenant_id, status);
CREATE INDEX idx_active_marketing_campaigns_next_send ON public.active_marketing_campaigns(next_send_at) WHERE status = 'active';
CREATE INDEX idx_active_marketing_campaigns_contact ON public.active_marketing_campaigns(contact_id, status);
CREATE INDEX idx_marketing_scheduled_messages_status ON public.marketing_scheduled_messages(status, scheduled_for);
CREATE INDEX idx_marketing_scheduled_messages_campaign ON public.marketing_scheduled_messages(active_campaign_id);

-- Trigger to update updated_at
CREATE TRIGGER update_marketing_campaigns_updated_at
BEFORE UPDATE ON public.marketing_campaigns
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();