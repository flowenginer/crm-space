-- Add payment gateway config to company_settings
ALTER TABLE company_settings 
ADD COLUMN IF NOT EXISTS payment_gateway_config JSONB DEFAULT '{}'::jsonb;

-- Create payment_links table
CREATE TABLE IF NOT EXISTS payment_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- References
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  
  -- Gateway data
  provider TEXT NOT NULL DEFAULT 'rede',
  external_id TEXT,
  payment_url TEXT,
  
  -- Configuration
  amount NUMERIC NOT NULL,
  description TEXT,
  payment_methods TEXT[] DEFAULT ARRAY['credit_card', 'pix'],
  max_installments INTEGER DEFAULT 1,
  expires_at TIMESTAMP WITH TIME ZONE,
  
  -- Customer data
  customer_name TEXT,
  customer_document TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  
  -- Status and payment
  status TEXT DEFAULT 'pending',
  paid_at TIMESTAMP WITH TIME ZONE,
  paid_amount NUMERIC,
  payment_method_used TEXT,
  installments_used INTEGER,
  
  -- Gateway response
  gateway_response JSONB DEFAULT '{}'::jsonb,
  webhook_received_at TIMESTAMP WITH TIME ZONE,
  
  -- Audit
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE payment_links ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view payment_links"
  ON payment_links FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert payment_links"
  ON payment_links FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update payment_links"
  ON payment_links FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_links_order_id ON payment_links(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_links_quote_id ON payment_links(quote_id);
CREATE INDEX IF NOT EXISTS idx_payment_links_conversation_id ON payment_links(conversation_id);
CREATE INDEX IF NOT EXISTS idx_payment_links_status ON payment_links(status);
CREATE INDEX IF NOT EXISTS idx_payment_links_external_id ON payment_links(external_id);

-- Add trigger for updated_at
CREATE TRIGGER update_payment_links_updated_at
  BEFORE UPDATE ON payment_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();