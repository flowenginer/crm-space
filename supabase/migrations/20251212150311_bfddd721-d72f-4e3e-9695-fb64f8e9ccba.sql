-- Add column to enable hybrid approach: templates can use global price rules or their own adjustments
ALTER TABLE product_templates
ADD COLUMN use_global_price_rules boolean DEFAULT false;

-- Add comment explaining the column
COMMENT ON COLUMN product_templates.use_global_price_rules IS 'When true, template variations will use global price rules from product_attribute_price_rules instead of their own price_adjustment values';