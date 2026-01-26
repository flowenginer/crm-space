-- Inserir itens de menu para o sistema de suporte no tenant BASE
-- Primeiro, buscar o tenant_id do Space Sports (tenant base)

DO $$
DECLARE
  v_base_tenant_id UUID;
  v_support_group_id UUID;
BEGIN
  -- Buscar tenant base (Space Sports)
  SELECT id INTO v_base_tenant_id FROM tenants WHERE slug = 'spacesports' LIMIT 1;
  
  IF v_base_tenant_id IS NULL THEN
    -- Fallback: pegar primeiro tenant
    SELECT id INTO v_base_tenant_id FROM tenants ORDER BY created_at LIMIT 1;
  END IF;
  
  IF v_base_tenant_id IS NULL THEN
    RAISE EXCEPTION 'No tenant found to insert menu items';
  END IF;

  -- Criar grupo de menu "Suporte"
  INSERT INTO menu_items (tenant_id, title, href, icon, parent_id, position, permission, is_active, module_key)
  VALUES (v_base_tenant_id, 'Suporte', NULL, 'LifeBuoy', NULL, 95, NULL, true, 'support_group')
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_support_group_id;
  
  -- Se já existe, buscar o ID
  IF v_support_group_id IS NULL THEN
    SELECT id INTO v_support_group_id FROM menu_items 
    WHERE tenant_id = v_base_tenant_id AND title = 'Suporte' AND parent_id IS NULL;
  END IF;

  -- Inserir submenus de suporte
  INSERT INTO menu_items (tenant_id, title, href, icon, parent_id, position, permission, is_active, module_key)
  VALUES 
    (v_base_tenant_id, 'Meus Tickets', '/suporte', 'Ticket', v_support_group_id, 1, 'support.view', true, 'support_tickets'),
    (v_base_tenant_id, 'Dashboard Suporte', '/admin/suporte', 'LayoutDashboard', v_support_group_id, 2, 'support.manage', true, 'support_dashboard'),
    (v_base_tenant_id, 'Gerenciar Técnicos', '/admin/suporte/tecnicos', 'UserCog', v_support_group_id, 3, 'support.admin', true, 'support_technicians')
  ON CONFLICT DO NOTHING;
  
  RAISE NOTICE 'Menu items for support system created successfully in tenant %', v_base_tenant_id;
END $$;

-- Inserir permissões de suporte em permission_definitions
INSERT INTO permission_definitions (category, permission_key, permission_name, description)
VALUES 
  ('support', 'support.view', 'Visualizar tickets', 'Permite visualizar e criar tickets de suporte'),
  ('support', 'support.manage', 'Gerenciar suporte', 'Permite gerenciar todos os tickets (técnicos)'),
  ('support', 'support.admin', 'Administrar suporte', 'Permite gerenciar técnicos de suporte')
ON CONFLICT (permission_key) DO NOTHING;