-- Remover constraint antiga e adicionar nova com 'official'
ALTER TABLE whatsapp_channels DROP CONSTRAINT whatsapp_channels_type_check;

ALTER TABLE whatsapp_channels ADD CONSTRAINT whatsapp_channels_type_check 
  CHECK (type = ANY (ARRAY['unofficial'::text, 'business'::text, 'official'::text]));

-- Criar canal oficial para a config existente
DO $$
DECLARE
  new_channel_id UUID;
  config_record RECORD;
BEGIN
  -- Buscar a config existente sem channel_id
  SELECT id, tenant_id, phone_number_id 
  INTO config_record
  FROM cloudapi_configs 
  WHERE channel_id IS NULL 
  LIMIT 1;
  
  IF config_record IS NOT NULL THEN
    -- Criar o canal oficial
    INSERT INTO whatsapp_channels (name, type, tenant_id, status, phone)
    VALUES (
      'WhatsApp Oficial', 
      'official', 
      config_record.tenant_id, 
      'connected',
      config_record.phone_number_id
    )
    RETURNING id INTO new_channel_id;
    
    -- Vincular o canal à config
    UPDATE cloudapi_configs 
    SET channel_id = new_channel_id
    WHERE id = config_record.id;
  END IF;
END $$;