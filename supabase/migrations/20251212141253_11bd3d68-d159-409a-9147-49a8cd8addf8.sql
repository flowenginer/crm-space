-- Criar tabela de templates de produto
CREATE TABLE public.product_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  default_weight_kg NUMERIC DEFAULT 0,
  default_height_cm NUMERIC DEFAULT 0,
  default_width_cm NUMERIC DEFAULT 0,
  default_length_cm NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, slug)
);

-- Criar tabela de variações do template
CREATE TABLE public.product_template_variations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id),
  template_id UUID REFERENCES public.product_templates(id) ON DELETE CASCADE,
  attribute_value_ids UUID[] NOT NULL DEFAULT '{}',
  variation_name TEXT,
  price_adjustment NUMERIC DEFAULT 0,
  adjustment_type TEXT DEFAULT 'fixed',
  weight_override NUMERIC,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Adicionar coluna template_id na tabela de produtos
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES public.product_templates(id);

-- Habilitar RLS
ALTER TABLE public.product_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_template_variations ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para product_templates
CREATE POLICY "Tenant isolation for product_templates"
ON public.product_templates
FOR ALL
USING (tenant_id = get_user_tenant_id());

-- Políticas RLS para product_template_variations
CREATE POLICY "Tenant isolation for product_template_variations"
ON public.product_template_variations
FOR ALL
USING (tenant_id = get_user_tenant_id());

-- Trigger para updated_at
CREATE TRIGGER update_product_templates_updated_at
  BEFORE UPDATE ON public.product_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Índices
CREATE INDEX idx_product_templates_tenant ON public.product_templates(tenant_id);
CREATE INDEX idx_product_template_variations_template ON public.product_template_variations(template_id);