-- Adicionar item de menu "Atualização em Massa" no grupo CRM
DO $$
DECLARE
  v_base_tenant_id UUID;
  v_crm_parent_id UUID;
BEGIN
  -- Buscar o tenant base
  SELECT id INTO v_base_tenant_id FROM tenants WHERE slug = 'base' LIMIT 1;
  
  IF v_base_tenant_id IS NULL THEN
    RAISE NOTICE 'Tenant base não encontrado, usando tenant mais antigo';
    SELECT id INTO v_base_tenant_id FROM tenants ORDER BY created_at LIMIT 1;
  END IF;
  
  -- Buscar o ID do menu CRM (parent)
  SELECT id INTO v_crm_parent_id 
  FROM menu_items 
  WHERE tenant_id = v_base_tenant_id 
    AND (title ILIKE '%CRM%' OR module_key = 'crm')
    AND parent_id IS NULL
  LIMIT 1;
  
  IF v_crm_parent_id IS NULL THEN
    RAISE NOTICE 'Menu CRM não encontrado, criando item no nível raiz';
  END IF;
  
  -- Inserir novo item de menu
  INSERT INTO menu_items (
    tenant_id,
    title,
    href,
    icon,
    parent_id,
    position,
    permission,
    is_active,
    module_key
  )
  VALUES (
    v_base_tenant_id,
    'Atualização em Massa',
    '/leads/atualizacao',
    'FileSpreadsheet',
    v_crm_parent_id,
    10, -- Posição após outros itens do CRM
    'deals.view',
    true,
    'crm_bulk_update'
  )
  ON CONFLICT DO NOTHING;
  
  RAISE NOTICE 'Menu item "Atualização em Massa" created in tenant %', v_base_tenant_id;
END $$;