-- MASTER-LEADS full migration

-- Move messages from 3 conflicting conversations
UPDATE messages 
SET conversation_id = CASE conversation_id
    WHEN '048e4341-83f4-46cb-89b3-fcbcc5092c66'::uuid THEN 'b7dbdacf-513f-4986-aad9-ba4b9ae31fca'::uuid
    WHEN '56592f97-d57b-4a42-ba81-82a7a2a7a25f'::uuid THEN '50b58efd-fb10-48d3-9b6f-503b71226d57'::uuid
    WHEN 'b26fc587-09ee-4b40-a7e8-7cb3b4aa760f'::uuid THEN 'c055af4b-046e-4823-9daa-57cff3339f05'::uuid
  END
WHERE conversation_id IN (
  '048e4341-83f4-46cb-89b3-fcbcc5092c66'::uuid,
  '56592f97-d57b-4a42-ba81-82a7a2a7a25f'::uuid,
  'b26fc587-09ee-4b40-a7e8-7cb3b4aa760f'::uuid
);

UPDATE conversation_events 
SET conversation_id = CASE conversation_id
    WHEN '048e4341-83f4-46cb-89b3-fcbcc5092c66'::uuid THEN 'b7dbdacf-513f-4986-aad9-ba4b9ae31fca'::uuid
    WHEN '56592f97-d57b-4a42-ba81-82a7a2a7a25f'::uuid THEN '50b58efd-fb10-48d3-9b6f-503b71226d57'::uuid
    WHEN 'b26fc587-09ee-4b40-a7e8-7cb3b4aa760f'::uuid THEN 'c055af4b-046e-4823-9daa-57cff3339f05'::uuid
  END
WHERE conversation_id IN (
  '048e4341-83f4-46cb-89b3-fcbcc5092c66'::uuid,
  '56592f97-d57b-4a42-ba81-82a7a2a7a25f'::uuid,
  'b26fc587-09ee-4b40-a7e8-7cb3b4aa760f'::uuid
);

DELETE FROM conversations WHERE id IN (
  '048e4341-83f4-46cb-89b3-fcbcc5092c66'::uuid,
  '56592f97-d57b-4a42-ba81-82a7a2a7a25f'::uuid,
  'b26fc587-09ee-4b40-a7e8-7cb3b4aa760f'::uuid
);

UPDATE conversations SET channel_id = '64d67c6e-684a-495c-9bb4-4961c1352e28'::uuid
WHERE channel_id = 'f125e3b1-2062-49f6-88e8-727c2aac8ace'::uuid;

UPDATE whatsapp_channel_events SET channel_id = '64d67c6e-684a-495c-9bb4-4961c1352e28'::uuid
WHERE channel_id = 'f125e3b1-2062-49f6-88e8-727c2aac8ace'::uuid;

UPDATE bulk_dispatches SET channel_id = '64d67c6e-684a-495c-9bb4-4961c1352e28'::uuid
WHERE channel_id = 'f125e3b1-2062-49f6-88e8-727c2aac8ace'::uuid;

UPDATE tenant_notification_config SET notification_channel_id = '64d67c6e-684a-495c-9bb4-4961c1352e28'::uuid
WHERE notification_channel_id = 'f125e3b1-2062-49f6-88e8-727c2aac8ace'::uuid;

UPDATE redirect_campaign_channels SET channel_id = '64d67c6e-684a-495c-9bb4-4961c1352e28'::uuid
WHERE channel_id = 'f125e3b1-2062-49f6-88e8-727c2aac8ace'::uuid;

DELETE FROM user_channels WHERE channel_id = 'f125e3b1-2062-49f6-88e8-727c2aac8ace'::uuid;

DELETE FROM whatsapp_channels WHERE id = 'f125e3b1-2062-49f6-88e8-727c2aac8ace'::uuid;