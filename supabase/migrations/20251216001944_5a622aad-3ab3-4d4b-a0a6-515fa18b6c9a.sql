-- Add packaging_type column to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS packaging_type TEXT DEFAULT 'stack';

-- Add comment explaining the field
COMMENT ON COLUMN products.packaging_type IS 'Tipo de embalagem para cálculo de frete: stack (empilhar), box (caixa individual), side_by_side (lado a lado), layered (em camadas), custom (dimensão fixa)';