-- Tabela: Tipos de Atributos de Produto
CREATE TABLE public.product_attribute_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_required BOOLEAN NOT NULL DEFAULT false,
  allow_multiple BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela: Valores de Atributos
CREATE TABLE public.product_attribute_values (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  attribute_type_id UUID NOT NULL REFERENCES public.product_attribute_types(id) ON DELETE CASCADE,
  value TEXT NOT NULL,
  display_value TEXT,
  slug TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(attribute_type_id, slug)
);

-- Índices para performance
CREATE INDEX idx_product_attribute_types_display_order ON public.product_attribute_types(display_order);
CREATE INDEX idx_product_attribute_values_type_id ON public.product_attribute_values(attribute_type_id);
CREATE INDEX idx_product_attribute_values_display_order ON public.product_attribute_values(attribute_type_id, display_order);

-- Enable RLS
ALTER TABLE public.product_attribute_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_attribute_values ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated access product_attribute_types" 
ON public.product_attribute_types 
FOR ALL 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated access product_attribute_values" 
ON public.product_attribute_values 
FOR ALL 
USING (auth.uid() IS NOT NULL);

-- Trigger para updated_at
CREATE TRIGGER update_product_attribute_types_updated_at
BEFORE UPDATE ON public.product_attribute_types
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_product_attribute_values_updated_at
BEFORE UPDATE ON public.product_attribute_values
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- SEED DATA: Atributos padrão

-- 1. Gênero
INSERT INTO public.product_attribute_types (id, name, slug, description, display_order, is_required)
VALUES ('a1000000-0000-0000-0000-000000000001', 'Gênero', 'genero', 'Gênero do produto', 1, true);

INSERT INTO public.product_attribute_values (attribute_type_id, value, slug, display_order)
VALUES 
  ('a1000000-0000-0000-0000-000000000001', 'Masculino', 'masculino', 1),
  ('a1000000-0000-0000-0000-000000000001', 'Feminino', 'feminino', 2),
  ('a1000000-0000-0000-0000-000000000001', 'Infantil', 'infantil', 3);

-- 2. Tamanho Adulto
INSERT INTO public.product_attribute_types (id, name, slug, description, display_order)
VALUES ('a1000000-0000-0000-0000-000000000002', 'Tamanho Adulto', 'tamanho-adulto', 'Tamanhos para adultos', 2);

INSERT INTO public.product_attribute_values (attribute_type_id, value, slug, display_order)
VALUES 
  ('a1000000-0000-0000-0000-000000000002', 'PP', 'pp', 1),
  ('a1000000-0000-0000-0000-000000000002', 'P', 'p', 2),
  ('a1000000-0000-0000-0000-000000000002', 'M', 'm', 3),
  ('a1000000-0000-0000-0000-000000000002', 'G', 'g', 4),
  ('a1000000-0000-0000-0000-000000000002', 'GG', 'gg', 5),
  ('a1000000-0000-0000-0000-000000000002', 'G1', 'g1', 6),
  ('a1000000-0000-0000-0000-000000000002', 'G2', 'g2', 7),
  ('a1000000-0000-0000-0000-000000000002', 'G3', 'g3', 8),
  ('a1000000-0000-0000-0000-000000000002', 'G4', 'g4', 9);

-- 3. Tamanho Infantil
INSERT INTO public.product_attribute_types (id, name, slug, description, display_order)
VALUES ('a1000000-0000-0000-0000-000000000003', 'Tamanho Infantil', 'tamanho-infantil', 'Tamanhos para crianças', 3);

INSERT INTO public.product_attribute_values (attribute_type_id, value, slug, display_order)
VALUES 
  ('a1000000-0000-0000-0000-000000000003', '1 ano', '1-ano', 1),
  ('a1000000-0000-0000-0000-000000000003', '2 anos', '2-anos', 2),
  ('a1000000-0000-0000-0000-000000000003', '3 anos', '3-anos', 3),
  ('a1000000-0000-0000-0000-000000000003', '4 anos', '4-anos', 4),
  ('a1000000-0000-0000-0000-000000000003', '5 anos', '5-anos', 5),
  ('a1000000-0000-0000-0000-000000000003', '6 anos', '6-anos', 6),
  ('a1000000-0000-0000-0000-000000000003', '7 anos', '7-anos', 7),
  ('a1000000-0000-0000-0000-000000000003', '8 anos', '8-anos', 8),
  ('a1000000-0000-0000-0000-000000000003', '10 anos', '10-anos', 9),
  ('a1000000-0000-0000-0000-000000000003', '12 anos', '12-anos', 10),
  ('a1000000-0000-0000-0000-000000000003', '14 anos', '14-anos', 11);

-- 4. Cor (vazio inicialmente)
INSERT INTO public.product_attribute_types (id, name, slug, description, display_order)
VALUES ('a1000000-0000-0000-0000-000000000004', 'Cor', 'cor', 'Cores disponíveis do produto', 4);