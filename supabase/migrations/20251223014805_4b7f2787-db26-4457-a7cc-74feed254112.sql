-- Inserir item de menu Super Admin abaixo de Gamificação
INSERT INTO menu_items (title, href, icon, position, is_active, parent_id, permission, roles, show_badge)
VALUES ('Super Admin', '/super-admin', 'Crown', 12, true, null, null, null, null)
ON CONFLICT DO NOTHING;