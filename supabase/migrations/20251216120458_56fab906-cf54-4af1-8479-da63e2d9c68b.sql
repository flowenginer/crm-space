-- Update product dimensions for clothing items that have NULL dimensions
-- Using typical folded shirt dimensions: 2cm height x 30cm width x 25cm length
UPDATE products 
SET 
  height_cm = COALESCE(height_cm, 2),
  width_cm = COALESCE(width_cm, 30),
  length_cm = COALESCE(length_cm, 25)
WHERE (height_cm IS NULL OR width_cm IS NULL OR length_cm IS NULL)
  AND (name ILIKE '%camisa%' OR name ILIKE '%camiseta%' OR name ILIKE '%blusa%' OR name ILIKE '%polo%');