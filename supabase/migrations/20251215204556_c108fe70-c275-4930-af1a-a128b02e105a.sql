-- Add dimension columns to products table for shipping calculations
ALTER TABLE products
ADD COLUMN IF NOT EXISTS height_cm NUMERIC,
ADD COLUMN IF NOT EXISTS width_cm NUMERIC,
ADD COLUMN IF NOT EXISTS length_cm NUMERIC;

-- Add comment for documentation
COMMENT ON COLUMN products.height_cm IS 'Product height in centimeters for shipping calculations';
COMMENT ON COLUMN products.width_cm IS 'Product width in centimeters for shipping calculations';
COMMENT ON COLUMN products.length_cm IS 'Product length in centimeters for shipping calculations';