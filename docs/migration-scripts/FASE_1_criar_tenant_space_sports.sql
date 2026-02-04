-- ============================================
-- FASE 1: CRIAÇÃO DO TENANT SPACE SPORTS
-- ============================================
-- Execute este script no Supabase SQL Editor
-- Data: ____/____/________
-- Responsável: ________________
--
-- IMPORTANTE: Faça backup do banco antes de executar!
-- ============================================

-- 1.1 Verificar estado atual (ANTES da migração)
SELECT
  'Dados no MASTER_TENANT (antes)' as info,
  (SELECT COUNT(*) FROM contacts WHERE tenant_id = '00000000-0000-0000-0000-000000000001') as contacts,
  (SELECT COUNT(*) FROM conversations WHERE tenant_id = '00000000-0000-0000-0000-000000000001') as conversations,
  (SELECT COUNT(*) FROM profiles WHERE tenant_id = '00000000-0000-0000-0000-000000000001') as profiles,
  (SELECT COUNT(*) FROM orders WHERE tenant_id = '00000000-0000-0000-0000-000000000001') as orders,
  (SELECT COUNT(*) FROM deals WHERE tenant_id = '00000000-0000-0000-0000-000000000001') as deals,
  (SELECT COUNT(*) FROM products WHERE tenant_id = '00000000-0000-0000-0000-000000000001') as products;

-- 1.2 Verificar se já existe tenant Space Sports
SELECT * FROM tenants WHERE slug = 'space-sports';

-- 1.3 Criar o Tenant Space Sports com UUID fixo
-- UUID: 11111111-1111-1111-1111-111111111111 (Space Sports)
INSERT INTO public.tenants (
  id,
  name,
  slug,
  plan_type,
  max_users,
  max_contacts,
  is_active,
  settings,
  created_at,
  updated_at
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Space Sports',
  'space-sports',
  'enterprise',
  100,
  500000,
  true,
  '{"theme": "default", "features": {"whatsapp": true, "email": true, "crm": true}}'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  updated_at = NOW();

-- 1.4 Verificar criação do tenant
SELECT
  id,
  name,
  slug,
  plan_type,
  max_users,
  max_contacts,
  is_active,
  created_at
FROM tenants
WHERE slug = 'space-sports';

-- 1.5 Criar tenant_modules para Space Sports (todos os módulos habilitados)
INSERT INTO public.tenant_modules (tenant_id, module_key, is_enabled, created_at)
SELECT
  '11111111-1111-1111-1111-111111111111',
  module_key,
  true,
  NOW()
FROM (
  VALUES
    ('conversations'),
    ('crm'),
    ('contacts'),
    ('orders'),
    ('quotes'),
    ('products'),
    ('financial'),
    ('reports'),
    ('campaigns'),
    ('gamification'),
    ('automations'),
    ('bulk_dispatch'),
    ('internal_chat'),
    ('internal_email'),
    ('live_monitor'),
    ('webhooks'),
    ('dashboard'),
    ('settings')
) AS modules(module_key)
ON CONFLICT (tenant_id, module_key) DO UPDATE SET
  is_enabled = true,
  updated_at = NOW();

-- 1.6 Verificar módulos criados
SELECT
  module_key,
  is_enabled,
  created_at
FROM tenant_modules
WHERE tenant_id = '11111111-1111-1111-1111-111111111111'
ORDER BY module_key;

-- 1.7 Resumo final da FASE 1
SELECT
  t.id,
  t.name,
  t.slug,
  t.plan_type,
  t.is_active,
  (SELECT COUNT(*) FROM tenant_modules WHERE tenant_id = t.id AND is_enabled = true) as modules_enabled
FROM tenants t
WHERE t.slug = 'space-sports';

-- ============================================
-- FIM DA FASE 1
-- Próximo passo: Executar FASE_2_migrar_dados.sql
-- ============================================
