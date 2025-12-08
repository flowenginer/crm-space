-- Corrigir permissões do role SAC/Expedição para usar os nomes corretos (read além de view)
UPDATE role_definitions 
SET permissions = '{
  "contacts": {"create": true, "update": true, "read": true, "view": true},
  "conversations": {"close": true, "create": true, "respond": true, "transfer": true, "read": true, "view": true, "view_all": true},
  "crm": {"deals": false, "media": true, "view": true},
  "dashboard": {"view": false},
  "schedules": {"create": true, "update": true, "view": true, "read": true},
  "templates": {"create": true, "update": true, "read": true, "view": true},
  "settings": {"view": true}
}'::jsonb
WHERE role_key = 'sac';