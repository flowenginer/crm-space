-- Corrigir role do usuário Space Tech para admin
UPDATE public.profiles 
SET role = 'admin'
WHERE id = 'a04a3d85-3d6a-41ba-92b4-f6b7e0d21f82';

-- Atualizar role_definitions do Space Tech com permissões completas
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
WHERE tenant_id = 'cd6e4ff0-7a6e-43a8-8a19-b8c3748e1385'
AND role_name = 'admin';