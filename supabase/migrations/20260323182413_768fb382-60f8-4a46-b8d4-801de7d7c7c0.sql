
-- Migrar EMPREGA-MAIS: conversas e dependências diretas
UPDATE conversations 
SET channel_id = '818a7e58-4076-447d-aa40-01cab1b91e0a'::uuid
WHERE channel_id = '0e2f9022-76b5-450e-a0a1-fe65f1f85104'::uuid;

UPDATE scheduled_messages 
SET channel_id = '818a7e58-4076-447d-aa40-01cab1b91e0a'::uuid
WHERE channel_id = '0e2f9022-76b5-450e-a0a1-fe65f1f85104'::uuid;

UPDATE flow_executions 
SET channel_id = '818a7e58-4076-447d-aa40-01cab1b91e0a'::uuid
WHERE channel_id = '0e2f9022-76b5-450e-a0a1-fe65f1f85104'::uuid;

UPDATE bulk_dispatches 
SET channel_id = '818a7e58-4076-447d-aa40-01cab1b91e0a'::uuid
WHERE channel_id = '0e2f9022-76b5-450e-a0a1-fe65f1f85104'::uuid;

UPDATE whatsapp_channel_events 
SET channel_id = '818a7e58-4076-447d-aa40-01cab1b91e0a'::uuid
WHERE channel_id = '0e2f9022-76b5-450e-a0a1-fe65f1f85104'::uuid;

UPDATE cloudapi_configs 
SET channel_id = '818a7e58-4076-447d-aa40-01cab1b91e0a'::uuid
WHERE channel_id = '0e2f9022-76b5-450e-a0a1-fe65f1f85104'::uuid;

UPDATE redirect_campaign_channels 
SET channel_id = '818a7e58-4076-447d-aa40-01cab1b91e0a'::uuid
WHERE channel_id = '0e2f9022-76b5-450e-a0a1-fe65f1f85104'::uuid;

DELETE FROM user_channels WHERE channel_id = '0e2f9022-76b5-450e-a0a1-fe65f1f85104'::uuid;

INSERT INTO user_channels (user_id, channel_id, tenant_id)
VALUES 
  ('e7a9fd22-e3ff-40b9-b01c-93549db399d0'::uuid, '818a7e58-4076-447d-aa40-01cab1b91e0a'::uuid, (SELECT tenant_id FROM whatsapp_channels WHERE id = '818a7e58-4076-447d-aa40-01cab1b91e0a'::uuid)),
  ('dfccab80-7c0c-4bf2-827d-f09574793b14'::uuid, '818a7e58-4076-447d-aa40-01cab1b91e0a'::uuid, (SELECT tenant_id FROM whatsapp_channels WHERE id = '818a7e58-4076-447d-aa40-01cab1b91e0a'::uuid)),
  ('326e11b2-e643-48b6-8cda-661e642a126b'::uuid, '818a7e58-4076-447d-aa40-01cab1b91e0a'::uuid, (SELECT tenant_id FROM whatsapp_channels WHERE id = '818a7e58-4076-447d-aa40-01cab1b91e0a'::uuid))
ON CONFLICT DO NOTHING;

DELETE FROM whatsapp_channels WHERE id = '0e2f9022-76b5-450e-a0a1-fe65f1f85104'::uuid;

-- Migrar MASTER-LEADS: conversas e dependências diretas
UPDATE conversations 
SET channel_id = '04bf2c88-8418-40b6-b678-f746bc879041'::uuid
WHERE channel_id = '64d67c6e-684a-495c-9bb4-4961c1352e28'::uuid;

UPDATE scheduled_messages 
SET channel_id = '04bf2c88-8418-40b6-b678-f746bc879041'::uuid
WHERE channel_id = '64d67c6e-684a-495c-9bb4-4961c1352e28'::uuid;

UPDATE flow_executions 
SET channel_id = '04bf2c88-8418-40b6-b678-f746bc879041'::uuid
WHERE channel_id = '64d67c6e-684a-495c-9bb4-4961c1352e28'::uuid;

UPDATE bulk_dispatches 
SET channel_id = '04bf2c88-8418-40b6-b678-f746bc879041'::uuid
WHERE channel_id = '64d67c6e-684a-495c-9bb4-4961c1352e28'::uuid;

UPDATE whatsapp_channel_events 
SET channel_id = '04bf2c88-8418-40b6-b678-f746bc879041'::uuid
WHERE channel_id = '64d67c6e-684a-495c-9bb4-4961c1352e28'::uuid;

UPDATE cloudapi_configs 
SET channel_id = '04bf2c88-8418-40b6-b678-f746bc879041'::uuid
WHERE channel_id = '64d67c6e-684a-495c-9bb4-4961c1352e28'::uuid;

UPDATE redirect_campaign_channels 
SET channel_id = '04bf2c88-8418-40b6-b678-f746bc879041'::uuid
WHERE channel_id = '64d67c6e-684a-495c-9bb4-4961c1352e28'::uuid;

DELETE FROM user_channels WHERE channel_id = '64d67c6e-684a-495c-9bb4-4961c1352e28'::uuid;

INSERT INTO user_channels (user_id, channel_id, tenant_id)
VALUES ('6d25c3fd-0c3e-4e59-bfee-faad61abdc8d'::uuid, '04bf2c88-8418-40b6-b678-f746bc879041'::uuid, (SELECT tenant_id FROM whatsapp_channels WHERE id = '04bf2c88-8418-40b6-b678-f746bc879041'::uuid))
ON CONFLICT DO NOTHING;

DELETE FROM whatsapp_channels WHERE id = '64d67c6e-684a-495c-9bb4-4961c1352e28'::uuid;
