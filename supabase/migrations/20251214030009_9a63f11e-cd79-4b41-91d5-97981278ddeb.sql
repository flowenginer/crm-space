-- Adicionar colunas de datas de pagamento na tabela quotes
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS down_payment_date date;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS first_installment_date date;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS payment_schedule jsonb DEFAULT '[]'::jsonb;

-- Adicionar colunas de datas de pagamento na tabela orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS down_payment_date date;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS first_installment_date date;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_schedule jsonb DEFAULT '[]'::jsonb;

-- Comentários para documentação
COMMENT ON COLUMN quotes.down_payment_date IS 'Data do pagamento da entrada';
COMMENT ON COLUMN quotes.first_installment_date IS 'Data da primeira parcela';
COMMENT ON COLUMN quotes.payment_schedule IS 'Cronograma completo de pagamentos em JSON';

COMMENT ON COLUMN orders.down_payment_date IS 'Data do pagamento da entrada';
COMMENT ON COLUMN orders.first_installment_date IS 'Data da primeira parcela';
COMMENT ON COLUMN orders.payment_schedule IS 'Cronograma completo de pagamentos em JSON';