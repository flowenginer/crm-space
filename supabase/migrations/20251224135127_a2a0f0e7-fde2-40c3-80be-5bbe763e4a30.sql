-- Fix menu for tenant michelsema@gmail.com (852653c8-3ab5-414a-98cd-ef44c0bbcfbb)
-- First delete all menu_items for this tenant
DELETE FROM menu_items WHERE tenant_id = '852653c8-3ab5-414a-98cd-ef44c0bbcfbb';

-- Copy root items from base tenant
INSERT INTO menu_items (tenant_id, title, href, icon, parent_id, position, permission, roles, is_active, show_badge)
SELECT
  '852653c8-3ab5-414a-98cd-ef44c0bbcfbb',
  title, href, icon, NULL, position, permission, roles, is_active, show_badge
FROM menu_items
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND parent_id IS NULL
ORDER BY position;

-- Copy level 1 children
INSERT INTO menu_items (tenant_id, title, href, icon, parent_id, position, permission, roles, is_active, show_badge)
SELECT
  '852653c8-3ab5-414a-98cd-ef44c0bbcfbb',
  child.title,
  child.href,
  child.icon,
  (
    SELECT new_parent.id
    FROM menu_items new_parent
    JOIN menu_items src_parent ON src_parent.id = child.parent_id
    WHERE new_parent.tenant_id = '852653c8-3ab5-414a-98cd-ef44c0bbcfbb'
      AND new_parent.href = src_parent.href
    LIMIT 1
  ),
  child.position,
  child.permission,
  child.roles,
  child.is_active,
  child.show_badge
FROM menu_items child
JOIN menu_items parent ON parent.id = child.parent_id
WHERE child.tenant_id = '00000000-0000-0000-0000-000000000001'
  AND child.parent_id IS NOT NULL
  AND parent.parent_id IS NULL
ORDER BY child.position;

-- Copy level 2 children (grandchildren)
INSERT INTO menu_items (tenant_id, title, href, icon, parent_id, position, permission, roles, is_active, show_badge)
SELECT
  '852653c8-3ab5-414a-98cd-ef44c0bbcfbb',
  grandchild.title,
  grandchild.href,
  grandchild.icon,
  (
    SELECT new_parent.id
    FROM menu_items new_parent
    JOIN menu_items src_parent ON src_parent.id = grandchild.parent_id
    WHERE new_parent.tenant_id = '852653c8-3ab5-414a-98cd-ef44c0bbcfbb'
      AND new_parent.href = src_parent.href
    LIMIT 1
  ),
  grandchild.position,
  grandchild.permission,
  grandchild.roles,
  grandchild.is_active,
  grandchild.show_badge
FROM menu_items grandchild
JOIN menu_items parent ON parent.id = grandchild.parent_id
WHERE grandchild.tenant_id = '00000000-0000-0000-0000-000000000001'
  AND grandchild.parent_id IS NOT NULL
  AND parent.parent_id IS NOT NULL
ORDER BY grandchild.position;