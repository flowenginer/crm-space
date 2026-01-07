-- Create table to log marketing actions executed
CREATE TABLE public.marketing_action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  active_campaign_id UUID REFERENCES public.active_marketing_campaigns(id) ON DELETE CASCADE,
  dispatch_id UUID REFERENCES public.bulk_dispatches(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  step_number INTEGER NOT NULL DEFAULT 0,
  trigger_type TEXT NOT NULL, -- 'on_reply', 'on_no_reply', 'on_send'
  action_type TEXT NOT NULL, -- 'transfer_to_agent', 'add_internal_note', 'change_lead_status', etc.
  action_config JSONB,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.marketing_action_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Tenant isolation for marketing_action_logs"
ON public.marketing_action_logs
FOR ALL
USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- Create indexes for performance
CREATE INDEX idx_marketing_action_logs_campaign ON public.marketing_action_logs(campaign_id);
CREATE INDEX idx_marketing_action_logs_dispatch ON public.marketing_action_logs(dispatch_id);
CREATE INDEX idx_marketing_action_logs_active_campaign ON public.marketing_action_logs(active_campaign_id);
CREATE INDEX idx_marketing_action_logs_tenant ON public.marketing_action_logs(tenant_id);
CREATE INDEX idx_marketing_action_logs_executed_at ON public.marketing_action_logs(executed_at);
CREATE INDEX idx_marketing_action_logs_action_type ON public.marketing_action_logs(action_type);