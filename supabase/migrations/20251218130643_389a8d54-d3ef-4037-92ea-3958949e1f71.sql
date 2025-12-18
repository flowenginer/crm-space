-- Redistribute active conversations from VENDAS 01 to other channels
-- Excludes contacts that already have open/pending conversations in destination channels

WITH destination_channels AS (
  SELECT unnest(ARRAY[
    '724d0cc8-1d04-49dc-84da-ac9375ef4e92',  -- VENDAS 02
    '8be00605-9a83-435d-b3e4-7a5614efc4d1',  -- VENDAS 03
    '1fc71b52-4ec3-4b4f-88bf-9e9b18e36bcb',  -- VENDAS 05
    '364cf304-9811-4fbe-9d67-ed3232a9d648',  -- VENDAS 06
    'a45dabe1-83d2-468d-9f84-138e2f11d347',  -- VENDAS 07
    '4626cc3d-980f-4a1f-9650-92ec16e4fe5d'   -- VENDAS 08
  ]::uuid[]) as channel_id
),
-- Get contacts that already have conversations in destination channels
contacts_with_existing AS (
  SELECT DISTINCT contact_id
  FROM conversations
  WHERE channel_id IN (SELECT channel_id FROM destination_channels)
    AND status IN ('open', 'pending')
),
-- Get eligible conversations to redistribute (excluding contacts with existing convos)
eligible_conversations AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (ORDER BY created_at) as rn
  FROM conversations
  WHERE channel_id = '1b81ac1d-418d-4ce6-91ae-aa2e0ae40c9d'  -- VENDAS 01
    AND status IN ('open', 'pending')
    AND contact_id NOT IN (SELECT contact_id FROM contacts_with_existing)
),
-- Count total eligible
total_eligible AS (
  SELECT COUNT(*) as total FROM eligible_conversations
)
UPDATE conversations c
SET channel_id = CASE 
  WHEN ec.rn <= (SELECT total/6 FROM total_eligible) THEN '724d0cc8-1d04-49dc-84da-ac9375ef4e92'::uuid      -- VENDAS 02
  WHEN ec.rn <= (SELECT total*2/6 FROM total_eligible) THEN '8be00605-9a83-435d-b3e4-7a5614efc4d1'::uuid    -- VENDAS 03
  WHEN ec.rn <= (SELECT total*3/6 FROM total_eligible) THEN '1fc71b52-4ec3-4b4f-88bf-9e9b18e36bcb'::uuid    -- VENDAS 05
  WHEN ec.rn <= (SELECT total*4/6 FROM total_eligible) THEN '364cf304-9811-4fbe-9d67-ed3232a9d648'::uuid    -- VENDAS 06
  WHEN ec.rn <= (SELECT total*5/6 FROM total_eligible) THEN 'a45dabe1-83d2-468d-9f84-138e2f11d347'::uuid    -- VENDAS 07
  ELSE '4626cc3d-980f-4a1f-9650-92ec16e4fe5d'::uuid                                                          -- VENDAS 08
END,
updated_at = now()
FROM eligible_conversations ec
WHERE c.id = ec.id;