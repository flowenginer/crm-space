-- 1. Atualizar menu "Configurações" para ser cascata (remover href)
UPDATE menu_items 
SET href = NULL 
WHERE title = 'Configurações' AND parent_id IS NULL;

-- 2. Atualizar menu "Relatórios" para ser cascata (remover href)
UPDATE menu_items 
SET href = NULL 
WHERE title = 'Relatórios' AND parent_id IS NULL;

-- 3. Inserir submenus de Configurações
INSERT INTO menu_items (title, href, icon, parent_id, position, permission, is_active)
SELECT 
  sub.title,
  sub.href,
  sub.icon,
  parent.id,
  sub.position,
  sub.permission,
  true
FROM (
  VALUES 
    ('Empresa', '/settings?tab=company', 'Building2', 1, 'settings.update'),
    ('Equipe', '/settings?tab=team', 'Users', 2, 'settings.users'),
    ('Perfis', '/settings?tab=roles', 'Shield', 3, NULL),
    ('Acesso Especial', '/settings?tab=access-permissions', 'Unlock', 4, NULL),
    ('Menu', '/settings?tab=menu', 'Menu', 5, NULL),
    ('Departamentos', '/settings?tab=departments', 'Building2', 6, 'settings.departments'),
    ('Lojas', '/settings?tab=stores', 'Store', 7, 'settings.update'),
    ('Canais', '/settings?tab=channels', 'MessageSquare', 8, 'settings.channels'),
    ('Campos', '/settings?tab=fields', 'Database', 9, 'settings.fields'),
    ('Etiquetas', '/settings?tab=tags', 'Tag', 10, 'settings.tags'),
    ('Metas', '/settings?tab=sales-goals', 'Target', 11, 'settings.update'),
    ('Responsável', '/settings?tab=owner-agent', 'UserCheck', 12, 'settings.update'),
    ('Fechamento', '/settings?tab=close-reasons', 'X', 13, 'settings.close_reasons'),
    ('Distribuição', '/settings?tab=lead-distribution', 'Share2', 14, 'settings.update'),
    ('Notificações', '/settings?tab=notifications', 'Bell', 15, NULL),
    ('Segurança', '/settings?tab=security', 'Key', 16, NULL),
    ('Integrações', '/settings?tab=integrations', 'Plug', 17, 'settings.integrations'),
    ('Meta Ads', '/settings?tab=meta-ads', 'Facebook', 18, 'marketing.manage'),
    ('Padrões de Origem', '/settings?tab=origin-patterns', 'Radar', 19, 'settings.update'),
    ('Geral', '/settings?tab=general', 'Palette', 20, 'settings.update'),
    ('Ferramentas', '/settings?tab=tools', 'Wrench', 21, 'settings.update'),
    ('Métricas', '/settings?tab=metrics', 'Target', 22, 'settings.update')
) AS sub(title, href, icon, position, permission)
CROSS JOIN (SELECT id FROM menu_items WHERE title = 'Configurações' AND parent_id IS NULL LIMIT 1) parent
ON CONFLICT DO NOTHING;

-- 4. Inserir submenus de Relatórios
INSERT INTO menu_items (title, href, icon, parent_id, position, permission, is_active)
SELECT 
  sub.title,
  sub.href,
  sub.icon,
  parent.id,
  sub.position,
  sub.permission,
  true
FROM (
  VALUES 
    ('SLA', '/reports?tab=sla', 'Clock', 1, 'reports.view_sla'),
    ('Atendimentos', '/reports?tab=attendance', 'MessageSquare', 2, 'reports.view_attendance'),
    ('Vendas', '/reports?tab=sales', 'DollarSign', 3, 'reports.view_sales'),
    ('Financeiro', '/reports?tab=financial', 'Wallet', 4, 'reports.view_financial'),
    ('Satisfação', '/reports?tab=satisfaction', 'Smile', 5, 'reports.view_satisfaction'),
    ('Performance', '/reports?tab=performance', 'Users', 6, 'reports.view_performance'),
    ('Transferências', '/reports?tab=transfers', 'ArrowLeftRight', 7, 'reports.view_transfers'),
    ('Ligações', '/reports?tab=calls', 'Phone', 8, 'reports.view_calls')
) AS sub(title, href, icon, position, permission)
CROSS JOIN (SELECT id FROM menu_items WHERE title = 'Relatórios' AND parent_id IS NULL LIMIT 1) parent
ON CONFLICT DO NOTHING;