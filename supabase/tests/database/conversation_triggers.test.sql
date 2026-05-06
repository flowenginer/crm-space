-- Tests pgTAP para os triggers conversations_fill_department_default
-- e conversations_close_disconnected_dupes (migration 20260506153643).
--
-- Como rodar:
--   supabase test db
--
-- Cada arquivo .test.sql roda em transacao isolada com ROLLBACK automatico.
-- Os IDs prefixados com 'ffffffff-' sao reservados pra teste e nao colidem
-- com dados de producao.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(6);

-- =====================================================
-- SETUP: tenant + departments + canais + contatos isolados
-- =====================================================
INSERT INTO public.departments (id, name, tenant_id) VALUES
  ('ffffffff-0000-0000-0000-000000000001', 'Test Dept A', 'ffffffff-0000-0000-0000-aaaaaaaaaaaa'),
  ('ffffffff-0000-0000-0000-000000000002', 'Test Dept B', 'ffffffff-0000-0000-0000-aaaaaaaaaaaa');

INSERT INTO public.whatsapp_channels (id, name, type, status, tenant_id, department_id, is_deleted) VALUES
  ('ffffffff-0000-0000-0000-000000000010', 'Test Official Connected',      'official',   'connected',    'ffffffff-0000-0000-0000-aaaaaaaaaaaa', 'ffffffff-0000-0000-0000-000000000001', false),
  ('ffffffff-0000-0000-0000-000000000011', 'Test Unofficial Disconnected', 'unofficial', 'disconnected', 'ffffffff-0000-0000-0000-aaaaaaaaaaaa', 'ffffffff-0000-0000-0000-000000000001', false),
  ('ffffffff-0000-0000-0000-000000000012', 'Test Other Connected',         'unofficial', 'connected',    'ffffffff-0000-0000-0000-aaaaaaaaaaaa', 'ffffffff-0000-0000-0000-000000000001', false),
  ('ffffffff-0000-0000-0000-000000000013', 'Test Disc Other Tenant',       'unofficial', 'disconnected', 'ffffffff-0000-0000-0000-bbbbbbbbbbbb', NULL,                                   false);

INSERT INTO public.contacts (id, full_name, phone, tenant_id) VALUES
  ('ffffffff-0000-0000-0000-000000000100', 'Test Contact A',  '5500001', 'ffffffff-0000-0000-0000-aaaaaaaaaaaa'),
  ('ffffffff-0000-0000-0000-000000000101', 'Test Contact B',  '5500002', 'ffffffff-0000-0000-0000-aaaaaaaaaaaa'),
  ('ffffffff-0000-0000-0000-000000000102', 'Test Contact C',  '5500003', 'ffffffff-0000-0000-0000-aaaaaaaaaaaa'),
  ('ffffffff-0000-0000-0000-000000000103', 'Test Contact T2', '5500004', 'ffffffff-0000-0000-0000-bbbbbbbbbbbb');

-- =====================================================
-- TEST 1 (1a): INSERT sem department_id em canal com dept -> preenche
-- =====================================================
INSERT INTO public.conversations (id, contact_id, channel_id, tenant_id, status)
VALUES ('ffffffff-0000-0000-0000-000000000200',
        'ffffffff-0000-0000-0000-000000000100',
        'ffffffff-0000-0000-0000-000000000010',
        'ffffffff-0000-0000-0000-aaaaaaaaaaaa', 'open');

SELECT is(
  (SELECT department_id::text FROM public.conversations WHERE id = 'ffffffff-0000-0000-0000-000000000200'),
  'ffffffff-0000-0000-0000-000000000001',
  '1a: INSERT preenche department_id do canal quando NEW.department_id IS NULL'
);

-- =====================================================
-- TEST 2 (1a): INSERT com department_id explicito -> nao sobrescreve
-- =====================================================
INSERT INTO public.conversations (id, contact_id, channel_id, tenant_id, status, department_id)
VALUES ('ffffffff-0000-0000-0000-000000000201',
        'ffffffff-0000-0000-0000-000000000101',
        'ffffffff-0000-0000-0000-000000000010',
        'ffffffff-0000-0000-0000-aaaaaaaaaaaa', 'open',
        'ffffffff-0000-0000-0000-000000000002');

SELECT is(
  (SELECT department_id::text FROM public.conversations WHERE id = 'ffffffff-0000-0000-0000-000000000201'),
  'ffffffff-0000-0000-0000-000000000002',
  '1a: INSERT respeita department_id explicito (nao sobrescreve)'
);

-- =====================================================
-- TEST 3 (1b): INSERT em canal connected fecha conv em canal disconnected
-- =====================================================
-- Setup: conv antiga do contato C em canal disconnected
INSERT INTO public.conversations (id, contact_id, channel_id, tenant_id, status)
VALUES ('ffffffff-0000-0000-0000-000000000300',
        'ffffffff-0000-0000-0000-000000000102',
        'ffffffff-0000-0000-0000-000000000011',
        'ffffffff-0000-0000-0000-aaaaaaaaaaaa', 'open');

-- Insert nova em canal connected do mesmo contato
INSERT INTO public.conversations (id, contact_id, channel_id, tenant_id, status)
VALUES ('ffffffff-0000-0000-0000-000000000301',
        'ffffffff-0000-0000-0000-000000000102',
        'ffffffff-0000-0000-0000-000000000010',
        'ffffffff-0000-0000-0000-aaaaaaaaaaaa', 'open');

SELECT is(
  (SELECT status FROM public.conversations WHERE id = 'ffffffff-0000-0000-0000-000000000300'),
  'closed',
  '1b: INSERT em canal connected fecha conv open em canal disconnected do mesmo contato'
);

-- =====================================================
-- TEST 4 (1b): closed_at eh preenchido na conv fechada
-- =====================================================
SELECT isnt(
  (SELECT closed_at FROM public.conversations WHERE id = 'ffffffff-0000-0000-0000-000000000300'),
  NULL,
  '1b: closed_at eh preenchido na conv fechada'
);

-- =====================================================
-- TEST 5 (1b): NAO fecha conv em canal connected
-- =====================================================
SELECT is(
  (SELECT status FROM public.conversations WHERE id = 'ffffffff-0000-0000-0000-000000000200'),
  'open',
  '1b: NAO fecha conv em canal connected'
);

-- =====================================================
-- TEST 6 (1b): NAO afeta conversations de outros tenants
-- =====================================================
-- Conv "antiga" do contato T2 em canal disconnected do tenant B
INSERT INTO public.conversations (id, contact_id, channel_id, tenant_id, status, department_id)
VALUES ('ffffffff-0000-0000-0000-000000000400',
        'ffffffff-0000-0000-0000-000000000103',
        'ffffffff-0000-0000-0000-000000000013',
        'ffffffff-0000-0000-0000-bbbbbbbbbbbb', 'open',
        'ffffffff-0000-0000-0000-000000000001');

-- INSERT em canal connected do tenant A NAO deve tocar conv 400 (tenant B)
INSERT INTO public.conversations (id, contact_id, channel_id, tenant_id, status)
VALUES ('ffffffff-0000-0000-0000-000000000401',
        'ffffffff-0000-0000-0000-000000000100',
        'ffffffff-0000-0000-0000-000000000012',
        'ffffffff-0000-0000-0000-aaaaaaaaaaaa', 'open');

SELECT is(
  (SELECT status FROM public.conversations WHERE id = 'ffffffff-0000-0000-0000-000000000400'),
  'open',
  '1b: NAO afeta conversations de outros tenants'
);

SELECT * FROM finish();

ROLLBACK;
