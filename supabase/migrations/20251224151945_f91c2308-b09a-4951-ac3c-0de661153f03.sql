-- Primeiro deletar os menu_items do tenant órfão
DELETE FROM menu_items WHERE tenant_id = '57233440-23ee-41b6-9558-9e3ee31e1e87';

-- Depois deletar tenant_modules
DELETE FROM tenant_modules WHERE tenant_id = '57233440-23ee-41b6-9558-9e3ee31e1e87';

-- Deletar company_settings
DELETE FROM company_settings WHERE tenant_id = '57233440-23ee-41b6-9558-9e3ee31e1e87';

-- Deletar departments
DELETE FROM departments WHERE tenant_id = '57233440-23ee-41b6-9558-9e3ee31e1e87';

-- Deletar role_definitions
DELETE FROM role_definitions WHERE tenant_id = '57233440-23ee-41b6-9558-9e3ee31e1e87';

-- Agora deletar o tenant órfão
DELETE FROM tenants WHERE id = '57233440-23ee-41b6-9558-9e3ee31e1e87';