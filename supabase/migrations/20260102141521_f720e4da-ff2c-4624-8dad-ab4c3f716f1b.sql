-- Correção 1: Remover política permissiva que permite qualquer usuário autenticado ver todos os role_definitions
DROP POLICY IF EXISTS "authenticated_read_role_definitions" ON role_definitions;

-- Correção 2: Identificar tenants fantasma (sem profiles associados)
-- Primeiro, vamos limpar os dados relacionados antes de deletar os tenants

-- Remover menu_items de tenants fantasma
DELETE FROM menu_items 
WHERE tenant_id NOT IN (
  SELECT DISTINCT tenant_id FROM profiles WHERE tenant_id IS NOT NULL
);

-- Remover role_definitions de tenants fantasma
DELETE FROM role_definitions 
WHERE tenant_id NOT IN (
  SELECT DISTINCT tenant_id FROM profiles WHERE tenant_id IS NOT NULL
);

-- Remover outras tabelas que podem ter referência a tenants fantasma
DELETE FROM departments 
WHERE tenant_id NOT IN (
  SELECT DISTINCT tenant_id FROM profiles WHERE tenant_id IS NOT NULL
);

DELETE FROM tags 
WHERE tenant_id NOT IN (
  SELECT DISTINCT tenant_id FROM profiles WHERE tenant_id IS NOT NULL
);

DELETE FROM company_settings 
WHERE tenant_id NOT IN (
  SELECT DISTINCT tenant_id FROM profiles WHERE tenant_id IS NOT NULL
);

DELETE FROM whatsapp_channels 
WHERE tenant_id NOT IN (
  SELECT DISTINCT tenant_id FROM profiles WHERE tenant_id IS NOT NULL
);

-- Agora deletar os tenants fantasma
DELETE FROM tenants 
WHERE id NOT IN (
  SELECT DISTINCT tenant_id FROM profiles WHERE tenant_id IS NOT NULL
);