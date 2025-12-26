-- Insert menu item for Satisfação under Configurações
-- First, get the parent_id for Configurações from the base tenant
DO $$
DECLARE
  v_parent_id uuid;
  v_base_tenant_id uuid := '00000000-0000-0000-0000-000000000001';
  v_max_position integer;
BEGIN
  -- Get the Configurações menu item id (parent)
  SELECT id INTO v_parent_id
  FROM menu_items
  WHERE tenant_id = v_base_tenant_id
    AND title = 'Configurações'
    AND parent_id IS NOT NULL
  LIMIT 1;

  -- If not found, try looking for it as a root item
  IF v_parent_id IS NULL THEN
    SELECT id INTO v_parent_id
    FROM menu_items
    WHERE tenant_id = v_base_tenant_id
      AND title = 'Configurações'
    LIMIT 1;
  END IF;

  -- Get max position for items under Configurações
  SELECT COALESCE(MAX(position), 0) INTO v_max_position
  FROM menu_items
  WHERE tenant_id = v_base_tenant_id
    AND parent_id = v_parent_id;

  -- Insert the Satisfação menu item for base tenant
  INSERT INTO menu_items (
    tenant_id,
    title,
    href,
    icon,
    parent_id,
    position,
    is_active,
    module_key
  ) VALUES (
    v_base_tenant_id,
    'Satisfação',
    '/settings?tab=satisfaction',
    'Star',
    v_parent_id,
    v_max_position + 1,
    true,
    'settings_satisfaction'
  )
  ON CONFLICT DO NOTHING;

  -- Copy to all other tenants
  INSERT INTO menu_items (tenant_id, title, href, icon, parent_id, position, is_active, module_key)
  SELECT 
    t.id,
    'Satisfação',
    '/settings?tab=satisfaction',
    'Star',
    (SELECT mi.id FROM menu_items mi WHERE mi.tenant_id = t.id AND mi.title = 'Configurações' LIMIT 1),
    v_max_position + 1,
    true,
    'settings_satisfaction'
  FROM tenants t
  WHERE t.id != v_base_tenant_id
    AND NOT EXISTS (
      SELECT 1 FROM menu_items 
      WHERE tenant_id = t.id 
        AND href = '/settings?tab=satisfaction'
    );
END $$;