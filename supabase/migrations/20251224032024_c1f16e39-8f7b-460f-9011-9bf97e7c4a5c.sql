-- Corrigir os 4 profiles com tenant_id NULL atribuindo ao Space Sports
UPDATE profiles 
SET tenant_id = '00000000-0000-0000-0000-000000000001' 
WHERE tenant_id IS NULL;

-- Atualizar o tenant para ter nome e slug corretos
UPDATE tenants 
SET 
  name = 'Space Sports',
  slug = 'space-sports',
  plan_type = 'enterprise',
  is_active = true,
  max_users = 999,
  max_contacts = 999999
WHERE id = '00000000-0000-0000-0000-000000000001';