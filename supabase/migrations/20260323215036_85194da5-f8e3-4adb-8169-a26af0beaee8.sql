ALTER TABLE instagram_configs 
ADD CONSTRAINT instagram_configs_tenant_id_unique UNIQUE (tenant_id);