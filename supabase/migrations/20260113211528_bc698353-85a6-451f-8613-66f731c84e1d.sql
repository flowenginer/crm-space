-- Create table for Meta Message Templates (WhatsApp Official API)
CREATE TABLE public.meta_message_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  cloudapi_config_id UUID REFERENCES public.cloudapi_configs(id) ON DELETE SET NULL,
  meta_template_id TEXT,
  name TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'pt_BR',
  category TEXT NOT NULL CHECK (category IN ('MARKETING', 'UTILITY', 'AUTHENTICATION')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('APPROVED', 'PENDING', 'REJECTED', 'PAUSED', 'DISABLED')),
  components JSONB NOT NULL DEFAULT '[]'::jsonb,
  example_values JSONB,
  rejection_reason TEXT,
  quality_score TEXT,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, name, language)
);

-- Enable RLS
ALTER TABLE public.meta_message_templates ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view templates from their tenant"
ON public.meta_message_templates
FOR SELECT
USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert templates for their tenant"
ON public.meta_message_templates
FOR INSERT
WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update templates from their tenant"
ON public.meta_message_templates
FOR UPDATE
USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete templates from their tenant"
ON public.meta_message_templates
FOR DELETE
USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- Create indexes for performance
CREATE INDEX idx_meta_message_templates_tenant ON public.meta_message_templates(tenant_id);
CREATE INDEX idx_meta_message_templates_status ON public.meta_message_templates(status);
CREATE INDEX idx_meta_message_templates_name ON public.meta_message_templates(name);
CREATE INDEX idx_meta_message_templates_config ON public.meta_message_templates(cloudapi_config_id);

-- Create trigger for updated_at
CREATE TRIGGER update_meta_message_templates_updated_at
BEFORE UPDATE ON public.meta_message_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();