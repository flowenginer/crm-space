-- ============================================
-- Criar menu "Marketing" e reorganizar itens
-- ============================================

DO $$
DECLARE
  t_id UUID;
  marketing_id UUID;
  crm_id UUID;
  bulk_dispatch_id UUID;
BEGIN
  -- Para cada tenant existente
  FOR t_id IN SELECT id FROM tenants LOOP
    
    -- Verificar se já existe menu Marketing para este tenant
    SELECT id INTO marketing_id 
    FROM menu_items 
    WHERE tenant_id = t_id 
      AND module_key = 'marketing_group'
    LIMIT 1;
    
    -- Se não existe, criar
    IF marketing_id IS NULL THEN
      -- 1. Criar menu pai Marketing
      INSERT INTO menu_items (
        tenant_id, title, href, icon, parent_id, position, 
        permission, roles, is_active, show_badge, module_key
      ) VALUES (
        t_id, 'Marketing', NULL, 'Megaphone', NULL, 3, 
        NULL, NULL, true, NULL, 'marketing_group'
      ) RETURNING id INTO marketing_id;
      
      -- 2. Adicionar submenu Dashboard Marketing
      INSERT INTO menu_items (
        tenant_id, title, href, icon, parent_id, position, 
        permission, roles, is_active, show_badge, module_key
      ) VALUES (
        t_id, 'Dashboard', '/marketing-dashboard', 'BarChart3', 
        marketing_id, 1, NULL, NULL, true, NULL, 'marketing_dashboard'
      );
      
      -- 3. Encontrar "Disparo em Massa" atual (está dentro de CRM)
      SELECT id INTO bulk_dispatch_id
      FROM menu_items 
      WHERE tenant_id = t_id 
        AND href = '/bulk-dispatch'
      LIMIT 1;
      
      -- 4. Mover "Disparo em Massa" para dentro de Marketing
      IF bulk_dispatch_id IS NOT NULL THEN
        UPDATE menu_items 
        SET parent_id = marketing_id, 
            position = 2,
            module_key = COALESCE(module_key, 'bulk_dispatch')
        WHERE id = bulk_dispatch_id;
      ELSE
        -- Se não existe, criar
        INSERT INTO menu_items (
          tenant_id, title, href, icon, parent_id, position, 
          permission, roles, is_active, show_badge, module_key
        ) VALUES (
          t_id, 'Disparo em Massa', '/bulk-dispatch', 'Send', 
          marketing_id, 2, NULL, NULL, true, NULL, 'bulk_dispatch'
        );
      END IF;
    END IF;
    
  END LOOP;
END $$;

-- ============================================
-- Ajustar posições dos outros menus raiz
-- ============================================

UPDATE menu_items 
SET position = position + 1 
WHERE parent_id IS NULL 
  AND position >= 3 
  AND module_key != 'marketing_group'
  AND module_key IS NOT NULL;