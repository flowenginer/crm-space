-- Atualizar o canal Vendas 02 para usar UAZAPI com os dados da instância conectada
UPDATE whatsapp_channels
SET 
  provider_id = '72f3412b-e7eb-4ef5-9108-d6812bb99a6f', -- UAZAPI
  instance_id = 'vendas-02-mjbzit5i',
  instance_token = 'edff02c6-86ba-4b4c-a7e0-ece91cad44a0',
  status = 'connected',
  phone = '5521976052644'
WHERE id = '724d0cc8-1d04-49dc-84da-ac9375ef4e92';

-- Remover o canal duplicado UAZAPI
DELETE FROM whatsapp_channels 
WHERE id = 'be515d05-57e1-4942-84e1-f3d0defb8e93';