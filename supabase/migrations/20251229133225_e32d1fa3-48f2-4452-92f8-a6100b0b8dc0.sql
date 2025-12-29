-- Add auto sync configuration fields to meta_ad_accounts
ALTER TABLE public.meta_ad_accounts 
ADD COLUMN IF NOT EXISTS auto_sync_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS sync_interval_hours integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS last_auto_sync_at timestamp with time zone;

-- Create meta_sync_logs table for tracking sync history
CREATE TABLE IF NOT EXISTS public.meta_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_account_id uuid NOT NULL REFERENCES public.meta_ad_accounts(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid REFERENCES public.tenants(id),
  sync_type text NOT NULL DEFAULT 'auto', -- 'auto' or 'manual'
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'success', 'error'
  started_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  campaigns_synced integer DEFAULT 0,
  insights_synced integer DEFAULT 0,
  error_message text,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on meta_sync_logs
ALTER TABLE public.meta_sync_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for meta_sync_logs
CREATE POLICY "Tenant isolation for meta_sync_logs" ON public.meta_sync_logs
  AS RESTRICTIVE FOR ALL
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Authenticated users can view sync logs" ON public.meta_sync_logs
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Service role can manage sync logs" ON public.meta_sync_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_sync_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_sync_logs TO service_role;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_meta_sync_logs_account_id ON public.meta_sync_logs(meta_account_id);
CREATE INDEX IF NOT EXISTS idx_meta_sync_logs_status ON public.meta_sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_meta_sync_logs_created_at ON public.meta_sync_logs(created_at DESC);