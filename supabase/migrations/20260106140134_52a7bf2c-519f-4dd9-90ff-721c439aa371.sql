-- =====================================================
-- FASE 2: OTIMIZAÇÕES AVANÇADAS DE PERFORMANCE
-- =====================================================

-- =====================================================
-- 1. OTIMIZAR FUNÇÃO is_admin() COM CACHE (PL/pgSQL)
-- =====================================================
CREATE OR REPLACE FUNCTION is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  ctx RECORD;
BEGIN
  -- Usa cache se for o usuário atual
  ctx := get_auth_context();
  IF _user_id = ctx.user_id THEN
    RETURN ctx.user_role = 'admin';
  END IF;
  
  -- Fallback para outros usuários
  RETURN EXISTS (
    SELECT 1 FROM profiles WHERE id = _user_id AND role = 'admin'
  );
END;
$$;

-- =====================================================
-- 2. CRIAR ÍNDICES FALTANTES (Tabelas com 99% seq scans)
-- =====================================================

-- Índice composto para chatbot_flows (usado no process-flow-triggers)
CREATE INDEX IF NOT EXISTS idx_chatbot_flows_tenant_active 
ON chatbot_flows (tenant_id, is_active) 
WHERE is_active = true;

-- Índice para flow_nodes por tipo (trigger lookups)
CREATE INDEX IF NOT EXISTS idx_flow_nodes_flow_type 
ON flow_nodes (flow_id, node_type);

-- Índice para lead_statuses (muito acessada)
CREATE INDEX IF NOT EXISTS idx_lead_statuses_tenant 
ON lead_statuses (tenant_id);

-- Índice para conversation_tags (179M seq scans!)
CREATE INDEX IF NOT EXISTS idx_conversation_tags_conv 
ON conversation_tags (conversation_id);

-- Índice para flow_executions (usado pelo cron process-flow-delays)
CREATE INDEX IF NOT EXISTS idx_flow_executions_waiting 
ON flow_executions (status, waiting_until) 
WHERE status IN ('waiting_delay', 'waiting_reply');

-- =====================================================
-- 3. RECRIAR VIEW contacts_safe COM CTE (PERFORMANCE)
-- Mantendo a mesma ordem de colunas da view original
-- =====================================================
DROP VIEW IF EXISTS contacts_safe;

CREATE VIEW contacts_safe AS
WITH auth_ctx AS (
  SELECT 
    auth.uid() as current_user_id,
    get_user_tenant_id() as tenant_id,
    is_admin(auth.uid()) as is_admin_user
)
SELECT 
    c.id,
    c.full_name,
    c.phone,
    c.email,
    c.avatar_url,
    CASE
        WHEN (ctx.is_admin_user OR (c.assigned_to = ctx.current_user_id)) 
        THEN c.cpf_cnpj
        ELSE mask_cpf_cnpj(c.cpf_cnpj)
    END AS cpf_cnpj,
    c.birth_date,
    c.street,
    c.number,
    c.city,
    c.state,
    c.country,
    c.zip_code,
    c.contact_type,
    c.person_type,
    c.lead_status,
    c.lead_score,
    c.negotiated_value,
    c.origin,
    c.origin_campaign,
    c.segment_id,
    c.department_id,
    c.assigned_to,
    c.notes,
    c.custom_fields,
    c.is_blocked,
    c.blocked_reason,
    c.is_online,
    c.is_typing,
    c.last_seen_at,
    c.first_contact_at,
    c.last_interaction_at,
    c.created_at,
    c.updated_at,
    c.tenant_id
FROM contacts c
CROSS JOIN auth_ctx ctx
WHERE c.tenant_id = ctx.tenant_id;

-- =====================================================
-- 4. ANALYZE NAS TABELAS COM NOVOS ÍNDICES
-- =====================================================
ANALYZE chatbot_flows;
ANALYZE flow_nodes;
ANALYZE lead_statuses;
ANALYZE conversation_tags;
ANALYZE flow_executions;