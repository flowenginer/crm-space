-- =============================================
-- Bling ERP Integration Tables
-- =============================================

-- Table: bling_integration_config
-- Stores OAuth credentials and sync settings per tenant
CREATE TABLE public.bling_integration_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- OAuth Credentials (stored per tenant)
  client_id TEXT,
  client_secret TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  
  -- Status
  is_active BOOLEAN DEFAULT false,
  is_configured BOOLEAN DEFAULT false,
  
  -- Sync Flags (per entity type)
  sync_contacts BOOLEAN DEFAULT true,
  sync_orders BOOLEAN DEFAULT true,
  sync_products BOOLEAN DEFAULT true,
  sync_quotes BOOLEAN DEFAULT true,
  sync_statuses BOOLEAN DEFAULT true,
  
  -- Auto Sync Settings
  auto_sync_enabled BOOLEAN DEFAULT false,
  sync_interval_hours INTEGER DEFAULT 1,
  last_sync_at TIMESTAMPTZ,
  next_sync_at TIMESTAMPTZ,
  
  -- Webhook Configuration
  webhook_url TEXT,
  webhook_secret TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- One config per tenant
  UNIQUE(tenant_id)
);

-- Table: bling_id_mappings
-- Maps local UUIDs to Bling IDs for bidirectional sync
CREATE TABLE public.bling_id_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Entity mapping
  entity_type TEXT NOT NULL, -- 'contact', 'order', 'product', 'quote', 'status', 'seller'
  local_id UUID NOT NULL,
  bling_id TEXT NOT NULL,
  bling_numero TEXT, -- Sequential number from Bling (e.g., order 1234)
  
  -- Sync status
  last_synced_at TIMESTAMPTZ DEFAULT now(),
  sync_status TEXT DEFAULT 'synced', -- 'synced', 'pending', 'error'
  sync_direction TEXT DEFAULT 'local_to_bling', -- 'local_to_bling', 'bling_to_local'
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Ensure unique mappings
  UNIQUE(tenant_id, entity_type, local_id),
  UNIQUE(tenant_id, entity_type, bling_id)
);

-- Table: bling_sync_logs
-- Detailed sync logs for monitoring and debugging
CREATE TABLE public.bling_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Sync info
  sync_type TEXT NOT NULL, -- 'manual', 'auto', 'webhook', 'individual'
  entity_type TEXT, -- 'contact', 'order', 'product', 'quote', 'status', 'all'
  direction TEXT DEFAULT 'bidirectional', -- 'local_to_bling', 'bling_to_local', 'bidirectional'
  
  -- Status
  status TEXT DEFAULT 'running', -- 'running', 'completed', 'failed', 'cancelled'
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  
  -- Counters
  total_records INTEGER DEFAULT 0,
  created_count INTEGER DEFAULT 0,
  updated_count INTEGER DEFAULT 0,
  skipped_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  
  -- Details
  errors JSONB DEFAULT '[]'::jsonb,
  details JSONB DEFAULT '{}'::jsonb,
  
  -- Who triggered
  triggered_by UUID REFERENCES public.profiles(id)
);

-- Enable RLS on all tables
ALTER TABLE public.bling_integration_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bling_id_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bling_sync_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bling_integration_config
CREATE POLICY "Tenant isolation for bling_integration_config"
  ON public.bling_integration_config
  AS RESTRICTIVE
  FOR ALL
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Authenticated access bling_integration_config"
  ON public.bling_integration_config
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage bling_integration_config"
  ON public.bling_integration_config
  FOR ALL
  USING (is_admin_or_supervisor(auth.uid()));

-- RLS Policies for bling_id_mappings
CREATE POLICY "Tenant isolation for bling_id_mappings"
  ON public.bling_id_mappings
  AS RESTRICTIVE
  FOR ALL
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Authenticated access bling_id_mappings"
  ON public.bling_id_mappings
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage bling_id_mappings"
  ON public.bling_id_mappings
  FOR ALL
  USING (is_admin_or_supervisor(auth.uid()));

-- RLS Policies for bling_sync_logs
CREATE POLICY "Tenant isolation for bling_sync_logs"
  ON public.bling_sync_logs
  AS RESTRICTIVE
  FOR ALL
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Authenticated access bling_sync_logs"
  ON public.bling_sync_logs
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage bling_sync_logs"
  ON public.bling_sync_logs
  FOR ALL
  USING (is_admin_or_supervisor(auth.uid()));

-- Indexes for performance
CREATE INDEX idx_bling_id_mappings_entity ON public.bling_id_mappings(tenant_id, entity_type);
CREATE INDEX idx_bling_id_mappings_local_id ON public.bling_id_mappings(tenant_id, local_id);
CREATE INDEX idx_bling_id_mappings_bling_id ON public.bling_id_mappings(tenant_id, bling_id);
CREATE INDEX idx_bling_sync_logs_tenant_status ON public.bling_sync_logs(tenant_id, status);
CREATE INDEX idx_bling_sync_logs_started_at ON public.bling_sync_logs(started_at DESC);

-- Trigger for updated_at on bling_integration_config
CREATE TRIGGER update_bling_integration_config_updated_at
  BEFORE UPDATE ON public.bling_integration_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for updated_at on bling_id_mappings
CREATE TRIGGER update_bling_id_mappings_updated_at
  BEFORE UPDATE ON public.bling_id_mappings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();