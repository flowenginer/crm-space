-- Tabela: Regras de Preço por Atributo
CREATE TABLE public.product_attribute_price_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID DEFAULT NULL, -- NULL = aplica a todos os produtos
  attribute_value_id UUID NOT NULL REFERENCES public.product_attribute_values(id) ON DELETE CASCADE,
  adjustment_type TEXT NOT NULL DEFAULT 'fixed' CHECK (adjustment_type IN ('fixed', 'percentage')),
  adjustment_value NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, attribute_value_id)
);

-- Índices para performance
CREATE INDEX idx_price_rules_product_id ON public.product_attribute_price_rules(product_id);
CREATE INDEX idx_price_rules_attribute_value_id ON public.product_attribute_price_rules(attribute_value_id);
CREATE INDEX idx_price_rules_active ON public.product_attribute_price_rules(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.product_attribute_price_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Authenticated access product_attribute_price_rules" 
ON public.product_attribute_price_rules 
FOR ALL 
USING (auth.uid() IS NOT NULL);

-- Trigger para updated_at
CREATE TRIGGER update_product_attribute_price_rules_updated_at
BEFORE UPDATE ON public.product_attribute_price_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();