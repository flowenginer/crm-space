-- =============================================
-- FASE B: MÓDULO ERP/PEDIDOS
-- =============================================

-- Tabela de pedidos
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,
  contact_id UUID REFERENCES public.contacts(id),
  conversation_id UUID REFERENCES public.conversations(id),
  channel_id UUID REFERENCES public.whatsapp_channels(id),
  
  -- Status e tipo
  status TEXT NOT NULL DEFAULT 'draft',
  payment_status TEXT DEFAULT 'pending',
  fulfillment_status TEXT DEFAULT 'pending',
  order_type TEXT DEFAULT 'sale',
  
  -- Valores
  subtotal NUMERIC(12,2) DEFAULT 0,
  discount_amount NUMERIC(12,2) DEFAULT 0,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  shipping_cost NUMERIC(12,2) DEFAULT 0,
  tax_amount NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) DEFAULT 0,
  
  -- Pagamento
  payment_method TEXT,
  paid_amount NUMERIC(12,2) DEFAULT 0,
  paid_at TIMESTAMP WITH TIME ZONE,
  
  -- Entrega
  shipping_method TEXT,
  shipping_address JSONB,
  tracking_code TEXT,
  shipped_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  
  -- Responsável
  assigned_to UUID REFERENCES public.profiles(id),
  
  -- Observações
  notes TEXT,
  internal_notes TEXT,
  
  -- Datas
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  canceled_at TIMESTAMP WITH TIME ZONE,
  canceled_reason TEXT
);

-- Tabela de itens do pedido
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  
  -- Produto/Variação
  product_id UUID REFERENCES public.products(id),
  variation_id UUID REFERENCES public.product_variations(id),
  
  -- Dados do item (snapshot no momento da venda)
  product_name TEXT NOT NULL,
  variation_name TEXT,
  sku TEXT,
  
  -- Valores
  unit_price NUMERIC(12,2) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  discount_amount NUMERIC(12,2) DEFAULT 0,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  subtotal NUMERIC(12,2) GENERATED ALWAYS AS ((unit_price * quantity) - discount_amount) STORED,
  
  -- Custo (para cálculo de margem)
  unit_cost NUMERIC(12,2) DEFAULT 0,
  
  -- Status de entrega do item
  fulfilled_quantity INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de histórico de status do pedido
CREATE TABLE public.order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by UUID REFERENCES public.profiles(id),
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de pagamentos do pedido
CREATE TABLE public.order_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  
  payment_method TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  status TEXT DEFAULT 'pending',
  
  -- Dados do pagamento
  transaction_id TEXT,
  gateway TEXT,
  gateway_response JSONB,
  
  paid_at TIMESTAMP WITH TIME ZONE,
  refunded_at TIMESTAMP WITH TIME ZONE,
  refund_amount NUMERIC(12,2),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices
CREATE INDEX idx_orders_tenant ON public.orders(tenant_id);
CREATE INDEX idx_orders_contact ON public.orders(contact_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_created ON public.orders(created_at DESC);
CREATE INDEX idx_orders_number ON public.orders(order_number);

CREATE INDEX idx_order_items_tenant ON public.order_items(tenant_id);
CREATE INDEX idx_order_items_order ON public.order_items(order_id);
CREATE INDEX idx_order_items_product ON public.order_items(product_id);

CREATE INDEX idx_order_status_history_order ON public.order_status_history(order_id);
CREATE INDEX idx_order_payments_order ON public.order_payments(order_id);

-- RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;

-- Policies para orders
CREATE POLICY "Tenant isolation for orders"
  ON public.orders FOR ALL
  USING (tenant_id = get_user_tenant_id());

-- Policies para order_items
CREATE POLICY "Tenant isolation for order_items"
  ON public.order_items FOR ALL
  USING (tenant_id = get_user_tenant_id());

-- Policies para order_status_history
CREATE POLICY "Tenant isolation for order_status_history"
  ON public.order_status_history FOR ALL
  USING (tenant_id = get_user_tenant_id());

-- Policies para order_payments
CREATE POLICY "Tenant isolation for order_payments"
  ON public.order_payments FOR ALL
  USING (tenant_id = get_user_tenant_id());

-- Função para gerar número do pedido
CREATE OR REPLACE FUNCTION generate_order_number(p_tenant_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year TEXT;
  v_count INTEGER;
  v_number TEXT;
BEGIN
  v_year := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  SELECT COUNT(*) + 1 INTO v_count
  FROM orders
  WHERE tenant_id = p_tenant_id
    AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE);
  
  v_number := v_year || '-' || LPAD(v_count::TEXT, 6, '0');
  
  RETURN v_number;
END;
$$;

-- Função para atualizar totais do pedido
CREATE OR REPLACE FUNCTION update_order_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subtotal NUMERIC(12,2);
BEGIN
  -- Calcular subtotal dos itens
  SELECT COALESCE(SUM(subtotal), 0) INTO v_subtotal
  FROM order_items
  WHERE order_id = COALESCE(NEW.order_id, OLD.order_id);
  
  -- Atualizar pedido
  UPDATE orders
  SET 
    subtotal = v_subtotal,
    total = v_subtotal - discount_amount + shipping_cost + tax_amount,
    updated_at = now()
  WHERE id = COALESCE(NEW.order_id, OLD.order_id);
  
  RETURN NEW;
END;
$$;

-- Trigger para atualizar totais
CREATE TRIGGER trigger_update_order_totals
  AFTER INSERT OR UPDATE OR DELETE ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_order_totals();

-- Função para registrar mudança de status
CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO order_status_history (tenant_id, order_id, from_status, to_status, changed_by)
    VALUES (NEW.tenant_id, NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para log de status
CREATE TRIGGER trigger_log_order_status
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION log_order_status_change();

-- Função para baixar estoque ao confirmar pedido
CREATE OR REPLACE FUNCTION process_order_inventory()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se mudou para confirmed, baixa estoque
  IF NEW.status = 'confirmed' AND OLD.status != 'confirmed' THEN
    -- Registrar movimentações de saída
    INSERT INTO inventory_movements (tenant_id, variation_id, movement_type, quantity, stock_before, stock_after, reference_type, reference_id, created_by)
    SELECT 
      oi.tenant_id,
      oi.variation_id,
      'sale',
      -oi.quantity,
      pv.stock_quantity,
      pv.stock_quantity - oi.quantity,
      'order',
      NEW.id,
      auth.uid()
    FROM order_items oi
    JOIN product_variations pv ON pv.id = oi.variation_id
    WHERE oi.order_id = NEW.id
      AND oi.variation_id IS NOT NULL;
    
    -- Atualizar estoque das variações
    UPDATE product_variations pv
    SET stock_quantity = pv.stock_quantity - oi.quantity
    FROM order_items oi
    WHERE oi.order_id = NEW.id
      AND oi.variation_id = pv.id;
  END IF;
  
  -- Se cancelou, devolve estoque
  IF NEW.status = 'canceled' AND OLD.status NOT IN ('canceled', 'draft') THEN
    -- Registrar movimentações de entrada (devolução)
    INSERT INTO inventory_movements (tenant_id, variation_id, movement_type, quantity, stock_before, stock_after, reference_type, reference_id, notes, created_by)
    SELECT 
      oi.tenant_id,
      oi.variation_id,
      'return',
      oi.quantity,
      pv.stock_quantity,
      pv.stock_quantity + oi.quantity,
      'order',
      NEW.id,
      'Cancelamento do pedido ' || NEW.order_number,
      auth.uid()
    FROM order_items oi
    JOIN product_variations pv ON pv.id = oi.variation_id
    WHERE oi.order_id = NEW.id
      AND oi.variation_id IS NOT NULL;
    
    -- Devolver estoque
    UPDATE product_variations pv
    SET stock_quantity = pv.stock_quantity + oi.quantity
    FROM order_items oi
    WHERE oi.order_id = NEW.id
      AND oi.variation_id = pv.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para processar inventário
CREATE TRIGGER trigger_process_order_inventory
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION process_order_inventory();