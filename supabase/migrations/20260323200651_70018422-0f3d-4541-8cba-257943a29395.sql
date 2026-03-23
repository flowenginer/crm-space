-- Instagram Direct configs table
CREATE TABLE public.instagram_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  channel_id uuid REFERENCES public.whatsapp_channels(id),
  page_id text NOT NULL,
  instagram_account_id text NOT NULL,
  page_access_token text NOT NULL,
  app_secret text,
  verify_token text NOT NULL DEFAULT gen_random_uuid()::text,
  is_active boolean DEFAULT true,
  webhook_configured boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, instagram_account_id)
);

ALTER TABLE public.instagram_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view their instagram configs"
  ON public.instagram_configs FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant admins can manage instagram configs"
  ON public.instagram_configs FOR ALL
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE TABLE public.instagram_webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  sender_id text,
  config_id uuid REFERENCES public.instagram_configs(id),
  channel_id uuid REFERENCES public.whatsapp_channels(id),
  tenant_id uuid REFERENCES public.tenants(id),
  processed boolean DEFAULT false,
  processing_error text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.instagram_webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view instagram webhook logs"
  ON public.instagram_webhook_logs FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Service can insert instagram webhook logs"
  ON public.instagram_webhook_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);