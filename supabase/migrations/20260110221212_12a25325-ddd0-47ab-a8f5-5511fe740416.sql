-- Limpar configuração antiga de Cloud API
DELETE FROM cloudapi_configs WHERE id = 'dc8c3666-9a5a-4d05-9767-b6dcef3c2187';

-- Atualizar canal antigo para desconectado
UPDATE whatsapp_channels SET status = 'disconnected' WHERE id = 'dde6d13f-2545-4f69-9f3e-57f894cdaccb';