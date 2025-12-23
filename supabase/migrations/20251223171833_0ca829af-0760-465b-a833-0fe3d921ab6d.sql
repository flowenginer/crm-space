-- Fase 1: Migrar conversas dos canais Evolution desconectados para os canais UAZAPI correspondentes

-- VENDAS 03: Evolution (mis4hfg1) → UAZAPI (mjc3f747)
UPDATE conversations 
SET channel_id = '469749a8-7a42-4ff6-ab31-ba4d34f7c4cd'
WHERE channel_id = '8be00605-9a83-435d-b3e4-7a5614efc4d1'
  AND tenant_id = '2c9ce215-9493-4c99-ab8d-918de14bc062';

-- VENDAS 01: Evolution (mis4dmlw) → UAZAPI (mjc4vqxh)  
UPDATE conversations
SET channel_id = '550374b7-6842-48d9-abbd-4d267e1f2977'
WHERE channel_id = '1b81ac1d-418d-4ce6-91ae-aa2e0ae40c9d'
  AND tenant_id = '2c9ce215-9493-4c99-ab8d-918de14bc062';

-- VENDAS 05: Evolution (mis4jhkp) → UAZAPI (mjc3gskq)
UPDATE conversations
SET channel_id = '2a5b8c9d-3e4f-5a6b-7c8d-9e0f1a2b3c4d'
WHERE channel_id = (SELECT id FROM whatsapp_channels WHERE instance_id = 'mis4jhkp' AND tenant_id = '2c9ce215-9493-4c99-ab8d-918de14bc062' LIMIT 1)
  AND tenant_id = '2c9ce215-9493-4c99-ab8d-918de14bc062';

-- VENDAS 06: Evolution (mis4mjbr) → UAZAPI (mjc3ko0s)
UPDATE conversations
SET channel_id = (SELECT id FROM whatsapp_channels WHERE instance_id = 'mjc3ko0s' AND tenant_id = '2c9ce215-9493-4c99-ab8d-918de14bc062' LIMIT 1)
WHERE channel_id = (SELECT id FROM whatsapp_channels WHERE instance_id = 'mis4mjbr' AND tenant_id = '2c9ce215-9493-4c99-ab8d-918de14bc062' LIMIT 1)
  AND tenant_id = '2c9ce215-9493-4c99-ab8d-918de14bc062';

-- VENDAS 07: Evolution (mis4pjgj) → UAZAPI (mjc3m8es)
UPDATE conversations
SET channel_id = (SELECT id FROM whatsapp_channels WHERE instance_id = 'mjc3m8es' AND tenant_id = '2c9ce215-9493-4c99-ab8d-918de14bc062' LIMIT 1)
WHERE channel_id = (SELECT id FROM whatsapp_channels WHERE instance_id = 'mis4pjgj' AND tenant_id = '2c9ce215-9493-4c99-ab8d-918de14bc062' LIMIT 1)
  AND tenant_id = '2c9ce215-9493-4c99-ab8d-918de14bc062';

-- VENDAS 08: Evolution (mis4qgd9) → UAZAPI (mjc3njtv)
UPDATE conversations
SET channel_id = (SELECT id FROM whatsapp_channels WHERE instance_id = 'mjc3njtv' AND tenant_id = '2c9ce215-9493-4c99-ab8d-918de14bc062' LIMIT 1)
WHERE channel_id = (SELECT id FROM whatsapp_channels WHERE instance_id = 'mis4qgd9' AND tenant_id = '2c9ce215-9493-4c99-ab8d-918de14bc062' LIMIT 1)
  AND tenant_id = '2c9ce215-9493-4c99-ab8d-918de14bc062';

-- Fase 2: Marcar canais Evolution desconectados como deletados
UPDATE whatsapp_channels 
SET is_deleted = true, deleted_at = now()
WHERE tenant_id = '2c9ce215-9493-4c99-ab8d-918de14bc062'
  AND status = 'disconnected'
  AND provider_id IN (SELECT id FROM whatsapp_providers WHERE code = 'evolution')
  AND is_deleted = false;