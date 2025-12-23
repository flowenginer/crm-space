-- 1. Corrigir o profile do Space Tech para role='admin'
UPDATE public.profiles 
SET role = 'admin'
WHERE tenant_id = (SELECT id FROM public.tenants WHERE name = 'Space Tech')
AND role != 'admin';

-- 2. Atualizar as role_definitions do Space Tech com permissões completas
UPDATE public.role_definitions
SET permissions = '{
  "dashboard": {"view": true},
  "conversations": {"view": true, "create": true, "update": true, "delete": true, "view_all": true, "transfer": true, "close": true},
  "contacts": {"view": true, "create": true, "update": true, "delete": true, "import": true, "export": true},
  "crm": {"view": true, "create": true, "update": true, "delete": true},
  "orders": {"view": true, "create": true, "update": true, "delete": true},
  "quotes": {"view": true, "create": true, "update": true, "delete": true},
  "products": {"view": true, "create": true, "update": true, "delete": true},
  "financial": {"view": true, "create": true, "update": true, "delete": true},
  "reports": {"view": true},
  "settings": {"view": true, "update": true},
  "users": {"view": true, "create": true, "update": true, "delete": true},
  "channels": {"view": true, "create": true, "update": true, "delete": true},
  "templates": {"view": true, "create": true, "update": true, "delete": true},
  "automations": {"view": true, "create": true, "update": true, "delete": true},
  "webhooks": {"view": true, "create": true, "update": true, "delete": true},
  "gamification": {"view": true, "update": true},
  "bulk_dispatch": {"view": true, "create": true},
  "rescue_templates": {"view": true, "create": true, "update": true, "delete": true},
  "live_monitor": {"view": true},
  "internal_chat": {"view": true},
  "internal_email": {"view": true, "create": true}
}'::jsonb
WHERE tenant_id = (SELECT id FROM public.tenants WHERE name = 'Space Tech')
AND role_name = 'admin';

-- 3. Adicionar permissões para outros roles também
UPDATE public.role_definitions
SET permissions = '{
  "dashboard": {"view": true},
  "conversations": {"view": true, "create": true, "update": true, "view_all": true, "transfer": true, "close": true},
  "contacts": {"view": true, "create": true, "update": true},
  "crm": {"view": true, "create": true, "update": true},
  "orders": {"view": true, "create": true, "update": true},
  "quotes": {"view": true, "create": true, "update": true},
  "products": {"view": true},
  "reports": {"view": true},
  "settings": {"view": true},
  "users": {"view": true},
  "channels": {"view": true},
  "templates": {"view": true, "create": true, "update": true},
  "live_monitor": {"view": true},
  "internal_chat": {"view": true},
  "internal_email": {"view": true}
}'::jsonb
WHERE tenant_id = (SELECT id FROM public.tenants WHERE name = 'Space Tech')
AND role_name = 'supervisor';

UPDATE public.role_definitions
SET permissions = '{
  "dashboard": {"view": true},
  "conversations": {"view": true, "create": true, "update": true},
  "contacts": {"view": true, "create": true, "update": true},
  "crm": {"view": true, "create": true, "update": true},
  "orders": {"view": true, "create": true},
  "quotes": {"view": true, "create": true},
  "products": {"view": true},
  "internal_chat": {"view": true}
}'::jsonb
WHERE tenant_id = (SELECT id FROM public.tenants WHERE name = 'Space Tech')
AND role_name = 'vendedor';

UPDATE public.role_definitions
SET permissions = '{
  "dashboard": {"view": true},
  "templates": {"view": true, "create": true, "update": true},
  "products": {"view": true, "create": true, "update": true},
  "internal_chat": {"view": true},
  "internal_email": {"view": true}
}'::jsonb
WHERE tenant_id = (SELECT id FROM public.tenants WHERE name = 'Space Tech')
AND role_name = 'designer';

UPDATE public.role_definitions
SET permissions = '{
  "dashboard": {"view": true},
  "conversations": {"view": true, "create": true, "update": true, "close": true},
  "contacts": {"view": true, "create": true, "update": true},
  "internal_chat": {"view": true}
}'::jsonb
WHERE tenant_id = (SELECT id FROM public.tenants WHERE name = 'Space Tech')
AND role_name = 'sac';