-- Inserir menu_items padrão para o tenant TOP CREATIVE (5b0b28a2-56dd-447e-b61d-36c432fc2d74)
INSERT INTO menu_items (tenant_id, title, href, icon, position, permission, is_active) VALUES
  ('5b0b28a2-56dd-447e-b61d-36c432fc2d74', 'Dashboard', '/', 'LayoutDashboard', 1, 'dashboard.view', true),
  ('5b0b28a2-56dd-447e-b61d-36c432fc2d74', 'Conversas', '/conversations', 'MessageSquare', 2, 'conversations.view', true),
  ('5b0b28a2-56dd-447e-b61d-36c432fc2d74', 'Contatos', '/contacts', 'Users', 3, 'contacts.view', true),
  ('5b0b28a2-56dd-447e-b61d-36c432fc2d74', 'WhatsApp', '/whatsapp-channels', 'Phone', 4, 'channels.view', true),
  ('5b0b28a2-56dd-447e-b61d-36c432fc2d74', 'Relatórios', '/reports', 'BarChart3', 5, 'reports.view', true),
  ('5b0b28a2-56dd-447e-b61d-36c432fc2d74', 'Configurações', '/settings', 'Settings', 6, 'settings.view', true)
ON CONFLICT DO NOTHING;