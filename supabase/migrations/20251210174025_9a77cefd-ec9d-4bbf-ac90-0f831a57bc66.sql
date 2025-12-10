-- =====================================================
-- OTIMIZAÇÃO DE PERFORMANCE - FASE 1: CPU
-- =====================================================
-- Esta migração é executada em transação única (segura)

-- 1. REMOVER ÍNDICES DUPLICADOS
-- Libera ~15MB de RAM e reduz overhead de INSERT/UPDATE

-- Verificar e remover duplicados de contacts
DROP INDEX IF EXISTS idx_contacts_phone;
DROP INDEX IF EXISTS idx_contacts_assigned_to;
DROP INDEX IF EXISTS idx_contacts_fullname_gin;
DROP INDEX IF EXISTS idx_contacts_phone_gin;

-- Verificar e remover duplicados de contact_tags  
DROP INDEX IF EXISTS idx_contact_tags_contact;
DROP INDEX IF EXISTS idx_contact_tags_tag;

-- 2. CRIAR ÍNDICE COMPOSTO OTIMIZADO PARA CONVERSAS
-- Cobre as queries de contagem mais frequentes
CREATE INDEX IF NOT EXISTS idx_conversations_status_filters 
ON conversations (status, department_id, assigned_to, channel_id, referral_source)
WHERE status IN ('open', 'pending');

-- 3. CRIAR ÍNDICE PARA CONTAGEM DE CONTATOS SEM TAG
CREATE INDEX IF NOT EXISTS idx_conversations_contact_status
ON conversations (contact_id, status)
WHERE status IN ('open', 'pending');

-- 4. ÍNDICE PARA user_departments (usado em RLS e queries)
CREATE INDEX IF NOT EXISTS idx_user_departments_user_id
ON user_departments (user_id);

-- 5. ÍNDICE PARA profiles.role (usado em is_admin_or_supervisor)
CREATE INDEX IF NOT EXISTS idx_profiles_role
ON profiles (role)
WHERE role IN ('admin', 'supervisor');

-- 6. ATUALIZAR ESTATÍSTICAS DO PLANEJADOR
ANALYZE contacts;
ANALYZE conversations;
ANALYZE contact_tags;
ANALYZE user_departments;
ANALYZE profiles;