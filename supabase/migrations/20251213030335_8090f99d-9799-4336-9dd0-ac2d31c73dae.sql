-- Adicionar coluna is_free_shipping na tabela orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_free_shipping boolean DEFAULT false;