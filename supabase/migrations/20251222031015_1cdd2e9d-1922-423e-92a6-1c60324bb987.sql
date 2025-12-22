-- Inserir item de menu pai: Gamificação
INSERT INTO public.menu_items (title, href, icon, parent_id, position, is_active)
VALUES (
  'Gamificação',
  NULL,
  'Trophy',
  NULL,
  11,
  true
);

-- Buscar o ID do item pai recém criado e inserir submenus
WITH parent AS (
  SELECT id FROM public.menu_items WHERE title = 'Gamificação' AND parent_id IS NULL LIMIT 1
)
INSERT INTO public.menu_items (title, href, icon, parent_id, position, is_active)
SELECT title, href, icon, parent.id, pos, true
FROM parent, (VALUES 
  ('Dashboard', '/gamification', 'Flag', 1),
  ('Rankings', '/gamification/rankings', 'Medal', 2),
  ('Conquistas', '/gamification/achievements', 'Star', 3),
  ('Configurações', '/gamification/settings', 'Settings', 4)
) AS t(title, href, icon, pos);