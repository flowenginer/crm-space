-- Tabela para armazenar preços customizáveis de templates por categoria
CREATE TABLE public.template_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  price_per_message NUMERIC(10,4) NOT NULL DEFAULT 0.50,
  currency TEXT NOT NULL DEFAULT 'BRL',
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, category, effective_from)
);

-- Enable RLS
ALTER TABLE public.template_pricing ENABLE ROW LEVEL SECURITY;

-- Policy for users to view pricing for their tenant
CREATE POLICY "Users can view template pricing for their tenant"
  ON public.template_pricing
  FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- Policy for admins to manage pricing
CREATE POLICY "Admins can manage template pricing"
  ON public.template_pricing
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'super_admin', 'owner')
    )
  );

-- Add index for performance
CREATE INDEX idx_template_pricing_tenant ON public.template_pricing(tenant_id);
CREATE INDEX idx_template_pricing_category ON public.template_pricing(tenant_id, category);

-- Trigger for updated_at
CREATE TRIGGER update_template_pricing_updated_at
  BEFORE UPDATE ON public.template_pricing
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();