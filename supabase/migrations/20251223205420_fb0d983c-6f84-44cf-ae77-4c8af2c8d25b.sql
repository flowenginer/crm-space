-- Limpar module_keys inválidas (UUIDs) da tabela tenant_modules
-- Formato UUID com underscores: xxxxxxxx_xxxx_xxxx_xxxx_xxxxxxxxxxxx
DELETE FROM tenant_modules 
WHERE module_key ~ '^[a-f0-9]{8}_[a-f0-9]{4}_[a-f0-9]{4}_[a-f0-9]{4}_[a-f0-9]{12}$';