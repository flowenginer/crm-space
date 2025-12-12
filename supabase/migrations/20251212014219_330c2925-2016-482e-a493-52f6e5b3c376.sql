-- ============================================================================
-- ETAPA 4: TABELA PRODUCTS (Produtos Base)
-- ============================================================================

-- Tabela principal de produtos
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  catalog_id UUID REFERENCES public.product_catalogs(id) ON DELETE SET NULL,
  
  -- Informações básicas
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255),
  description TEXT,
  short_description VARCHAR(500),
  
  -- Preços
  base_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  cost_price DECIMAL(10,2) DEFAULT 0,
  compare_at_price DECIMAL(10,2), -- Preço "de" para mostrar desconto
  
  -- Imagens
  main_image_url TEXT,
  gallery_images JSONB DEFAULT '[]',
  
  -- Configurações
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  has_variations BOOLEAN DEFAULT true,
  track_inventory BOOLEAN DEFAULT false,
  
  -- Organização
  tags TEXT[],
  display_order INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  
  -- Full-text search
  search_vector tsvector,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Constraint de unicidade por tenant
  UNIQUE(tenant_id, slug)
);

-- Índices para performance
CREATE INDEX idx_products_tenant ON public.products(tenant_id);
CREATE INDEX idx_products_catalog ON public.products(catalog_id);
CREATE INDEX idx_products_active ON public.products(tenant_id, is_active);
CREATE INDEX idx_products_featured ON public.products(tenant_id, is_featured) WHERE is_featured = true;
CREATE INDEX idx_products_tags ON public.products USING GIN(tags);
CREATE INDEX idx_products_search ON public.products USING GIN(search_vector);
CREATE INDEX idx_products_slug ON public.products(slug);

-- Função para atualizar search_vector
CREATE OR REPLACE FUNCTION public.update_products_search_vector()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.search_vector := to_tsvector('portuguese', 
    COALESCE(NEW.name, '') || ' ' || 
    COALESCE(NEW.description, '') || ' ' ||
    COALESCE(NEW.short_description, '') || ' ' ||
    COALESCE(array_to_string(NEW.tags, ' '), '')
  );
  RETURN NEW;
END;
$$;

-- Trigger para atualizar search_vector automaticamente
CREATE TRIGGER update_products_search
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_products_search_vector();

-- Trigger para atualizar updated_at
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for products" ON public.products
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

-- ============================================================================
-- ETAPA 5: TABELA PRODUCT_ATTRIBUTES (Atributos por Produto)
-- Define quais tipos de atributos cada produto usa
-- ============================================================================

CREATE TABLE public.product_attributes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  attribute_type_id UUID NOT NULL REFERENCES public.product_attribute_types(id) ON DELETE CASCADE,
  is_required BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Cada produto só pode ter um tipo de atributo uma vez
  UNIQUE(product_id, attribute_type_id)
);

CREATE INDEX idx_product_attributes_product ON public.product_attributes(product_id);
CREATE INDEX idx_product_attributes_type ON public.product_attributes(attribute_type_id);

-- RLS (herda do produto pai)
ALTER TABLE public.product_attributes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access via product" ON public.product_attributes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.products p 
      WHERE p.id = product_id 
      AND p.tenant_id = public.get_user_tenant_id()
    )
  );

-- ============================================================================
-- ETAPA 6: TABELA PRODUCT_VARIATIONS (SKUs/Variações)
-- ============================================================================

CREATE TABLE public.product_variations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  
  -- Identificação
  sku VARCHAR(100) NOT NULL,
  barcode VARCHAR(100),
  
  -- Atributos da variação (ex: {"cor": "Azul", "tamanho": "M"})
  attributes JSONB NOT NULL DEFAULT '{}',
  attribute_value_ids UUID[] DEFAULT '{}',
  variation_name VARCHAR(500), -- Nome gerado: "Azul / M / Masculino"
  
  -- Preço
  price DECIMAL(10,2), -- Preço calculado ou sobrescrito
  price_override BOOLEAN DEFAULT false, -- Se true, ignora regras de preço
  cost_price DECIMAL(10,2),
  
  -- Dimensões para frete
  weight_kg DECIMAL(8,3) DEFAULT 0,
  height_cm DECIMAL(8,2) DEFAULT 0,
  width_cm DECIMAL(8,2) DEFAULT 0,
  length_cm DECIMAL(8,2) DEFAULT 0,
  
  -- Imagem específica da variação
  image_url TEXT,
  
  -- Estoque
  stock_quantity INTEGER DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 5,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- SKU único por tenant
  UNIQUE(tenant_id, sku)
);

-- Índices
CREATE INDEX idx_variations_tenant ON public.product_variations(tenant_id);
CREATE INDEX idx_variations_product ON public.product_variations(product_id);
CREATE INDEX idx_variations_sku ON public.product_variations(sku);
CREATE INDEX idx_variations_barcode ON public.product_variations(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_variations_attributes ON public.product_variations USING GIN(attributes);
CREATE INDEX idx_variations_attribute_ids ON public.product_variations USING GIN(attribute_value_ids);
CREATE INDEX idx_variations_low_stock ON public.product_variations(tenant_id, stock_quantity) 
  WHERE stock_quantity <= low_stock_threshold;

-- Trigger para updated_at
CREATE TRIGGER update_variations_updated_at
  BEFORE UPDATE ON public.product_variations
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.product_variations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for variations" ON public.product_variations
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

-- ============================================================================
-- ETAPA 7: TABELA INVENTORY_MOVEMENTS (Movimentações de Estoque)
-- ============================================================================

CREATE TABLE public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  variation_id UUID NOT NULL REFERENCES public.product_variations(id) ON DELETE CASCADE,
  
  -- Tipo de movimentação
  movement_type VARCHAR(50) NOT NULL, -- entrada_manual, saida_manual, venda, devolução, ajuste, transferencia
  quantity INTEGER NOT NULL, -- Positivo = entrada, Negativo = saída
  
  -- Saldo antes e depois
  stock_before INTEGER NOT NULL,
  stock_after INTEGER NOT NULL,
  
  -- Referência (ex: pedido, ajuste)
  reference_type VARCHAR(50), -- order, adjustment, transfer, return
  reference_id UUID,
  
  -- Detalhes
  notes TEXT,
  cost_per_unit DECIMAL(10,2),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Índices
CREATE INDEX idx_inventory_movements_tenant ON public.inventory_movements(tenant_id);
CREATE INDEX idx_inventory_movements_variation ON public.inventory_movements(variation_id);
CREATE INDEX idx_inventory_movements_date ON public.inventory_movements(created_at);
CREATE INDEX idx_inventory_movements_type ON public.inventory_movements(movement_type);
CREATE INDEX idx_inventory_movements_reference ON public.inventory_movements(reference_type, reference_id) 
  WHERE reference_id IS NOT NULL;

-- RLS
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for inventory_movements" ON public.inventory_movements
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

-- ============================================================================
-- FUNÇÃO: Calcular preço da variação baseado nas regras
-- ============================================================================

CREATE OR REPLACE FUNCTION public.calculate_variation_price(
  p_product_id UUID,
  p_attribute_value_ids UUID[],
  p_tenant_id UUID
)
RETURNS DECIMAL
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base_price DECIMAL;
  v_final_price DECIMAL;
  v_rule RECORD;
BEGIN
  -- Buscar preço base do produto
  SELECT base_price INTO v_base_price
  FROM public.products
  WHERE id = p_product_id;
  
  IF v_base_price IS NULL THEN
    RETURN 0;
  END IF;
  
  v_final_price := v_base_price;
  
  -- Aplicar regras de preço por atributo
  FOR v_rule IN (
    SELECT adjustment_type, adjustment_value
    FROM public.product_attribute_price_rules
    WHERE attribute_value_id = ANY(p_attribute_value_ids)
      AND is_active = true
      AND (product_id = p_product_id OR (product_id IS NULL AND tenant_id = p_tenant_id))
    ORDER BY priority DESC, product_id NULLS LAST
  )
  LOOP
    IF v_rule.adjustment_type = 'fixed' THEN
      v_final_price := v_final_price + v_rule.adjustment_value;
    ELSIF v_rule.adjustment_type = 'percentage' THEN
      v_final_price := v_final_price * (1 + v_rule.adjustment_value / 100);
    END IF;
  END LOOP;
  
  RETURN ROUND(v_final_price, 2);
END;
$$;

-- ============================================================================
-- FUNÇÃO: Registrar movimentação de estoque e atualizar saldo
-- ============================================================================

CREATE OR REPLACE FUNCTION public.register_inventory_movement(
  p_variation_id UUID,
  p_movement_type VARCHAR(50),
  p_quantity INTEGER,
  p_reference_type VARCHAR(50) DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_cost_per_unit DECIMAL DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_stock_before INTEGER;
  v_stock_after INTEGER;
  v_movement_id UUID;
BEGIN
  -- Buscar tenant e estoque atual
  SELECT tenant_id, stock_quantity 
  INTO v_tenant_id, v_stock_before
  FROM public.product_variations
  WHERE id = p_variation_id;
  
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Variação não encontrada';
  END IF;
  
  -- Calcular novo estoque
  v_stock_after := v_stock_before + p_quantity;
  
  -- Não permitir estoque negativo (opcional, pode ser configurável)
  IF v_stock_after < 0 THEN
    RAISE EXCEPTION 'Estoque insuficiente. Atual: %, Solicitado: %', v_stock_before, p_quantity;
  END IF;
  
  -- Registrar movimentação
  INSERT INTO public.inventory_movements (
    tenant_id,
    variation_id,
    movement_type,
    quantity,
    stock_before,
    stock_after,
    reference_type,
    reference_id,
    notes,
    cost_per_unit,
    created_by
  )
  VALUES (
    v_tenant_id,
    p_variation_id,
    p_movement_type,
    p_quantity,
    v_stock_before,
    v_stock_after,
    p_reference_type,
    p_reference_id,
    p_notes,
    p_cost_per_unit,
    auth.uid()
  )
  RETURNING id INTO v_movement_id;
  
  -- Atualizar estoque da variação
  UPDATE public.product_variations
  SET stock_quantity = v_stock_after,
      updated_at = NOW()
  WHERE id = p_variation_id;
  
  RETURN v_movement_id;
END;
$$;

-- ============================================================================
-- FIM DAS ETAPAS 4-7
-- ============================================================================