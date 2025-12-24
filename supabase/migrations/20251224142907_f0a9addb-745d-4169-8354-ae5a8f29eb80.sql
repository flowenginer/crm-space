
-- ==========================================================
-- MIGRATION: Adicionar module_key aos menus cascata + Limpar keys órfãs
-- ==========================================================

-- ETAPA 1: Adicionar module_key para menus cascata (sem href)
-- Esses menus são grupos/pastas que contêm submenus

-- CRM (grupo principal)
UPDATE menu_items 
SET module_key = 'crm_group'
WHERE id = 'f49fb05a-f125-4a93-9534-00b3cf305b44'
AND tenant_id = '00000000-0000-0000-0000-000000000001';

-- Produtos (submenu de ERP)
UPDATE menu_items 
SET module_key = 'products_group'
WHERE id = 'fb6eb768-4d1f-44a4-b491-16d0029caad9'
AND tenant_id = '00000000-0000-0000-0000-000000000001';

-- Configurações ERP (submenu de ERP)
UPDATE menu_items 
SET module_key = 'erp_settings_group'
WHERE id = '4bd95e22-6f23-4a46-b3dd-aa36b85ecf49'
AND tenant_id = '00000000-0000-0000-0000-000000000001';

-- Integrações (grupo principal)
UPDATE menu_items 
SET module_key = 'integrations_group'
WHERE id = '8b34a5fa-b5cd-4b84-a169-b86d710545ee'
AND tenant_id = '00000000-0000-0000-0000-000000000001';

-- Relatórios (grupo principal)
UPDATE menu_items 
SET module_key = 'reports_group'
WHERE id = '35a0c87e-7185-47e7-8e1d-930687d72685'
AND tenant_id = '00000000-0000-0000-0000-000000000001';

-- Configurações (grupo principal)
UPDATE menu_items 
SET module_key = 'settings_group'
WHERE id = '9240ef7d-d4e5-4ae9-b260-06180d15f453'
AND tenant_id = '00000000-0000-0000-0000-000000000001';

-- Configurações CRM (submenu de CRM)
UPDATE menu_items 
SET module_key = 'crm_settings_group'
WHERE id = 'dda56c7a-a66f-4156-8d7d-3f0cc0bb675c'
AND tenant_id = '00000000-0000-0000-0000-000000000001';

-- ==========================================================
-- ETAPA 2: Remover tenant_modules com keys órfãs (não existem em menu_items)
-- ==========================================================

DELETE FROM tenant_modules tm
WHERE NOT EXISTS (
  SELECT 1 FROM menu_items mi 
  WHERE mi.module_key = tm.module_key
  AND mi.tenant_id = '00000000-0000-0000-0000-000000000001'
  AND mi.is_active = true
);

-- ==========================================================
-- ETAPA 3: Inserir as novas module_keys de grupos para todos os tenants
-- ==========================================================

INSERT INTO tenant_modules (tenant_id, module_key, is_enabled)
SELECT t.id, mi.module_key, true
FROM tenants t
CROSS JOIN menu_items mi
WHERE mi.tenant_id = '00000000-0000-0000-0000-000000000001'
  AND mi.module_key IS NOT NULL
  AND mi.is_active = true
  AND mi.href IS NULL  -- Apenas grupos cascata
  AND NOT EXISTS (
    SELECT 1 FROM tenant_modules tm
    WHERE tm.tenant_id = t.id AND tm.module_key = mi.module_key
  )
ON CONFLICT (tenant_id, module_key) DO NOTHING;

-- ==========================================================
-- ETAPA 4: Garantir que todos os tenants tenham todas as module_keys
-- ==========================================================

INSERT INTO tenant_modules (tenant_id, module_key, is_enabled)
SELECT t.id, mi.module_key, true
FROM tenants t
CROSS JOIN menu_items mi
WHERE mi.tenant_id = '00000000-0000-0000-0000-000000000001'
  AND mi.module_key IS NOT NULL
  AND mi.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM tenant_modules tm
    WHERE tm.tenant_id = t.id AND tm.module_key = mi.module_key
  )
ON CONFLICT (tenant_id, module_key) DO NOTHING;
