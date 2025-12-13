-- Add payment condition fields to quotes table
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS payment_condition text DEFAULT 'full';
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS down_payment_type text DEFAULT 'percent';
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS down_payment_value numeric(10,2) DEFAULT 0;

-- Add payment condition fields to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_condition text DEFAULT 'full';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS down_payment_type text DEFAULT 'percent';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS down_payment_value numeric(10,2) DEFAULT 0;

-- Add comments for documentation
COMMENT ON COLUMN quotes.payment_condition IS 'Payment condition: full, installments, down_payment';
COMMENT ON COLUMN quotes.down_payment_type IS 'Down payment type: percent or fixed';
COMMENT ON COLUMN quotes.down_payment_value IS 'Down payment value (percentage or fixed amount)';
COMMENT ON COLUMN orders.payment_condition IS 'Payment condition: full, installments, down_payment';
COMMENT ON COLUMN orders.down_payment_type IS 'Down payment type: percent or fixed';
COMMENT ON COLUMN orders.down_payment_value IS 'Down payment value (percentage or fixed amount)';