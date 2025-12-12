-- FASE 1: Infraestrutura de Banco de Dados

-- 1.1 Criar tabela de lojas
CREATE TABLE public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#8B5CF6',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

-- RLS policies for stores
CREATE POLICY "Users can view stores from their tenant"
ON public.stores FOR SELECT
USING (tenant_id = get_user_tenant_id() OR tenant_id IS NULL);

CREATE POLICY "Admins can manage stores"
ON public.stores FOR ALL
USING (is_admin_or_supervisor(auth.uid()));

-- 1.2 Adicionar campos na tabela orders
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.stores(id),
ADD COLUMN IF NOT EXISTS seller_id UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS expected_delivery_date DATE,
ADD COLUMN IF NOT EXISTS installments INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS item_discount DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_discount DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_type TEXT DEFAULT 'fixed',
ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS internal_notes TEXT,
ADD COLUMN IF NOT EXISTS customer_notes TEXT;

-- 1.3 Adicionar campos de comissão e metas na tabela profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS commission_percent DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS sales_target_1 DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS sales_target_2 DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS sales_target_3 DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS bonus_target_1 DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS bonus_target_2 DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS bonus_target_3 DECIMAL(12,2) DEFAULT 0;

-- 1.4 Adicionar campos na tabela order_payments
ALTER TABLE public.order_payments
ADD COLUMN IF NOT EXISTS installment_number INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS due_date DATE,
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_orders_store_id ON public.orders(store_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller_id ON public.orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_expected_delivery ON public.orders(expected_delivery_date);
CREATE INDEX IF NOT EXISTS idx_order_payments_due_date ON public.order_payments(due_date);

-- Trigger para updated_at em stores
CREATE TRIGGER update_stores_updated_at
BEFORE UPDATE ON public.stores
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();