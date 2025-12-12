-- Create quotes table
CREATE TABLE public.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id),
  quote_number TEXT NOT NULL,
  contact_id UUID REFERENCES public.contacts(id),
  conversation_id UUID REFERENCES public.conversations(id),
  channel_id UUID REFERENCES public.whatsapp_channels(id),
  status TEXT NOT NULL DEFAULT 'draft',
  
  -- Values
  subtotal NUMERIC DEFAULT 0,
  discount_amount NUMERIC DEFAULT 0,
  discount_percent NUMERIC DEFAULT 0,
  shipping_cost NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  
  -- Payment info (informative only, no financial transaction)
  payment_method TEXT,
  installments INTEGER DEFAULT 1,
  
  -- Delivery
  shipping_method TEXT,
  shipping_address JSONB,
  expected_delivery_date DATE,
  
  -- Additional info
  seller_id UUID REFERENCES public.profiles(id),
  store_id UUID REFERENCES public.stores(id),
  notes TEXT,
  internal_notes TEXT,
  valid_until DATE,
  
  -- Conversion
  converted_to_order_id UUID REFERENCES public.orders(id),
  converted_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create quote_items table
CREATE TABLE public.quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id),
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  variation_id UUID REFERENCES public.product_variations(id),
  product_name TEXT NOT NULL,
  variation_name TEXT,
  sku TEXT,
  unit_price NUMERIC NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  discount_amount NUMERIC DEFAULT 0,
  discount_percent NUMERIC DEFAULT 0,
  subtotal NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for quotes
CREATE POLICY "Tenant isolation for quotes"
ON public.quotes
FOR ALL
USING (tenant_id = get_user_tenant_id());

-- RLS policies for quote_items
CREATE POLICY "Tenant isolation for quote_items"
ON public.quote_items
FOR ALL
USING (tenant_id = get_user_tenant_id());

-- Function to generate quote number
CREATE OR REPLACE FUNCTION generate_quote_number(p_tenant_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_year TEXT;
  v_sequence INTEGER;
  v_quote_number TEXT;
BEGIN
  v_year := TO_CHAR(NOW(), 'YYYY');
  
  SELECT COALESCE(MAX(
    CASE 
      WHEN quote_number ~ ('^ORC-' || v_year || '-[0-9]+$')
      THEN CAST(SUBSTRING(quote_number FROM '[0-9]+$') AS INTEGER)
      ELSE 0
    END
  ), 0) + 1
  INTO v_sequence
  FROM quotes
  WHERE tenant_id = p_tenant_id;
  
  v_quote_number := 'ORC-' || v_year || '-' || LPAD(v_sequence::TEXT, 6, '0');
  
  RETURN v_quote_number;
END;
$$;

-- Create indexes
CREATE INDEX idx_quotes_tenant_id ON public.quotes(tenant_id);
CREATE INDEX idx_quotes_contact_id ON public.quotes(contact_id);
CREATE INDEX idx_quotes_status ON public.quotes(status);
CREATE INDEX idx_quotes_created_at ON public.quotes(created_at DESC);
CREATE INDEX idx_quote_items_quote_id ON public.quote_items(quote_id);