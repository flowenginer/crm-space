-- Create table for Bling status mappings
CREATE TABLE public.bling_status_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL DEFAULT 'order', -- 'order' or 'quote'
  bling_status_id TEXT NOT NULL,
  bling_status_name TEXT NOT NULL,
  local_status TEXT NOT NULL,
  color TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, entity_type, bling_status_id)
);

-- Enable RLS
ALTER TABLE public.bling_status_mappings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their tenant status mappings"
  ON public.bling_status_mappings FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert status mappings for their tenant"
  ON public.bling_status_mappings FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update their tenant status mappings"
  ON public.bling_status_mappings FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete their tenant status mappings"
  ON public.bling_status_mappings FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- Add sync_statuses column to bling_integration_config if not exists
ALTER TABLE public.bling_integration_config 
ADD COLUMN IF NOT EXISTS sync_statuses BOOLEAN DEFAULT true;

-- Create index for faster lookups
CREATE INDEX idx_bling_status_mappings_lookup 
ON public.bling_status_mappings(tenant_id, entity_type, bling_status_id);

-- Create trigger for updated_at
CREATE TRIGGER update_bling_status_mappings_updated_at
  BEFORE UPDATE ON public.bling_status_mappings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();