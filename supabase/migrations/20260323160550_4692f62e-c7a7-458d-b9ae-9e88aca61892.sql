-- Step 1: Move messages from 5 conflicting conversations
UPDATE messages 
SET conversation_id = CASE conversation_id
    WHEN 'd6eb043e-6304-40ba-a50e-c95ab0016727'::uuid THEN 'e7dd6be8-1b50-4bef-896d-b42ba8bb9e61'::uuid
    WHEN '7dbf497d-b28e-4fd3-924e-db6ed648fd58'::uuid THEN '0306b3a9-cef1-499c-89e9-f4f1e40b0960'::uuid
    WHEN 'fc62e155-7fcc-4cde-8446-836e6b8a5b84'::uuid THEN '06ed007c-6d3e-4e05-b005-4309c626c998'::uuid
    WHEN '2b55e23e-6234-4801-8d0a-bf3e7e326525'::uuid THEN '1e38ec53-2acf-46a3-9640-dc73ef0f356b'::uuid
    WHEN '2bd1a156-43b7-452b-99a8-06ab31866358'::uuid THEN '24d8bc5d-443f-4b84-8c57-d09a8b9aca04'::uuid
  END
WHERE conversation_id IN (
  'd6eb043e-6304-40ba-a50e-c95ab0016727'::uuid,
  '7dbf497d-b28e-4fd3-924e-db6ed648fd58'::uuid,
  'fc62e155-7fcc-4cde-8446-836e6b8a5b84'::uuid,
  '2b55e23e-6234-4801-8d0a-bf3e7e326525'::uuid,
  '2bd1a156-43b7-452b-99a8-06ab31866358'::uuid
);

-- Step 2: Move conversation_events from conflicting conversations
UPDATE conversation_events 
SET conversation_id = CASE conversation_id
    WHEN 'd6eb043e-6304-40ba-a50e-c95ab0016727'::uuid THEN 'e7dd6be8-1b50-4bef-896d-b42ba8bb9e61'::uuid
    WHEN '7dbf497d-b28e-4fd3-924e-db6ed648fd58'::uuid THEN '0306b3a9-cef1-499c-89e9-f4f1e40b0960'::uuid
    WHEN 'fc62e155-7fcc-4cde-8446-836e6b8a5b84'::uuid THEN '06ed007c-6d3e-4e05-b005-4309c626c998'::uuid
    WHEN '2b55e23e-6234-4801-8d0a-bf3e7e326525'::uuid THEN '1e38ec53-2acf-46a3-9640-dc73ef0f356b'::uuid
    WHEN '2bd1a156-43b7-452b-99a8-06ab31866358'::uuid THEN '24d8bc5d-443f-4b84-8c57-d09a8b9aca04'::uuid
  END
WHERE conversation_id IN (
  'd6eb043e-6304-40ba-a50e-c95ab0016727'::uuid,
  '7dbf497d-b28e-4fd3-924e-db6ed648fd58'::uuid,
  'fc62e155-7fcc-4cde-8446-836e6b8a5b84'::uuid,
  '2b55e23e-6234-4801-8d0a-bf3e7e326525'::uuid,
  '2bd1a156-43b7-452b-99a8-06ab31866358'::uuid
);

-- Step 3: Delete 5 conflicting old conversations
DELETE FROM conversations WHERE id IN (
  'd6eb043e-6304-40ba-a50e-c95ab0016727'::uuid,
  '7dbf497d-b28e-4fd3-924e-db6ed648fd58'::uuid,
  'fc62e155-7fcc-4cde-8446-836e6b8a5b84'::uuid,
  '2b55e23e-6234-4801-8d0a-bf3e7e326525'::uuid,
  '2bd1a156-43b7-452b-99a8-06ab31866358'::uuid
);

-- Step 4: Migrate ALL remaining conversations
UPDATE conversations SET channel_id = '0e2f9022-76b5-450e-a0a1-fe65f1f85104'::uuid
WHERE channel_id = 'ed6f2c8c-7339-4e92-8948-3f74baf280df'::uuid;

-- Step 5: Migrate scheduled_messages (259)
UPDATE scheduled_messages SET channel_id = '0e2f9022-76b5-450e-a0a1-fe65f1f85104'::uuid
WHERE channel_id = 'ed6f2c8c-7339-4e92-8948-3f74baf280df'::uuid;

-- Step 6: Migrate flow_executions (1860)
UPDATE flow_executions SET channel_id = '0e2f9022-76b5-450e-a0a1-fe65f1f85104'::uuid
WHERE channel_id = 'ed6f2c8c-7339-4e92-8948-3f74baf280df'::uuid;

-- Step 7: Migrate whatsapp_channel_events (8)
UPDATE whatsapp_channel_events SET channel_id = '0e2f9022-76b5-450e-a0a1-fe65f1f85104'::uuid
WHERE channel_id = 'ed6f2c8c-7339-4e92-8948-3f74baf280df'::uuid;

-- Step 8: Clean up user_channels
DELETE FROM user_channels WHERE channel_id = 'ed6f2c8c-7339-4e92-8948-3f74baf280df'::uuid;

-- Step 9: Migrate tenant_notification_config if any
UPDATE tenant_notification_config SET notification_channel_id = '0e2f9022-76b5-450e-a0a1-fe65f1f85104'::uuid
WHERE notification_channel_id = 'ed6f2c8c-7339-4e92-8948-3f74baf280df'::uuid;

-- Step 10: Migrate redirect_campaign_channels if any
UPDATE redirect_campaign_channels SET channel_id = '0e2f9022-76b5-450e-a0a1-fe65f1f85104'::uuid
WHERE channel_id = 'ed6f2c8c-7339-4e92-8948-3f74baf280df'::uuid;

-- Step 11: Remove the old duplicate channel
DELETE FROM whatsapp_channels WHERE id = 'ed6f2c8c-7339-4e92-8948-3f74baf280df'::uuid;