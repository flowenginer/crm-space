ALTER TABLE tags ADD COLUMN order_position integer DEFAULT 0;

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY name) as rn
  FROM tags
)
UPDATE tags SET order_position = ranked.rn FROM ranked WHERE tags.id = ranked.id;