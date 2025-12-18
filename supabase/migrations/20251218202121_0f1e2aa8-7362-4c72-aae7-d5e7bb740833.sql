
-- =====================================================
-- FASE 1: Limpar contatos órfãos (sem conversas)
-- =====================================================

-- Primeiro, remover referências em tabelas relacionadas
DELETE FROM contact_tags 
WHERE contact_id IN (
  SELECT c.id FROM contacts c 
  WHERE NOT EXISTS (SELECT 1 FROM conversations cv WHERE cv.contact_id = c.id)
);

-- Remover os contatos órfãos
DELETE FROM contacts c
WHERE NOT EXISTS (SELECT 1 FROM conversations cv WHERE cv.contact_id = c.id);

-- =====================================================
-- FASE 2: Remover funções duplicadas get_date_filter_counts
-- =====================================================

-- Dropar ambas as versões
DROP FUNCTION IF EXISTS public.get_date_filter_counts(uuid, uuid, uuid, text, text);
DROP FUNCTION IF EXISTS public.get_date_filter_counts(text, uuid, uuid, uuid, text);

-- Criar versão única e definitiva usando conversations.created_at
CREATE OR REPLACE FUNCTION public.get_date_filter_counts(
  p_timezone text DEFAULT 'America/Sao_Paulo'::text,
  p_department_id uuid DEFAULT NULL::uuid,
  p_agent_id uuid DEFAULT NULL::uuid,
  p_channel_id uuid DEFAULT NULL::uuid,
  p_origin text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result JSONB;
  now_tz TIMESTAMPTZ;
  today_start TIMESTAMPTZ;
  yesterday_start TIMESTAMPTZ;
  week_start TIMESTAMPTZ;
  last_week_start TIMESTAMPTZ;
  month_start TIMESTAMPTZ;
  last_month_start TIMESTAMPTZ;
BEGIN
  now_tz := NOW() AT TIME ZONE p_timezone;
  
  today_start := DATE_TRUNC('day', now_tz) AT TIME ZONE p_timezone;
  yesterday_start := today_start - INTERVAL '1 day';
  week_start := DATE_TRUNC('week', now_tz) AT TIME ZONE p_timezone;
  last_week_start := week_start - INTERVAL '1 week';
  month_start := DATE_TRUNC('month', now_tz) AT TIME ZONE p_timezone;
  last_month_start := month_start - INTERVAL '1 month';

  -- Usa conversations.created_at como referência de data
  SELECT jsonb_build_object(
    'today', (
      SELECT COUNT(DISTINCT c.id) 
      FROM conversations c 
      WHERE c.status IN ('open', 'pending')
        AND c.created_at >= today_start 
        AND c.created_at < today_start + INTERVAL '1 day' 
        AND (p_department_id IS NULL OR c.department_id = p_department_id) 
        AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
        AND (p_channel_id IS NULL OR c.channel_id = p_channel_id)
        AND (p_origin IS NULL OR p_origin = 'all' OR
             (p_origin = 'meta_ads' AND c.referral_source = 'meta_ads') OR
             (p_origin = 'organic' AND (c.referral_source IS NULL OR c.referral_source != 'meta_ads')))
    ),
    'yesterday', (
      SELECT COUNT(DISTINCT c.id) 
      FROM conversations c 
      WHERE c.status IN ('open', 'pending')
        AND c.created_at >= yesterday_start 
        AND c.created_at < today_start 
        AND (p_department_id IS NULL OR c.department_id = p_department_id) 
        AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
        AND (p_channel_id IS NULL OR c.channel_id = p_channel_id)
        AND (p_origin IS NULL OR p_origin = 'all' OR
             (p_origin = 'meta_ads' AND c.referral_source = 'meta_ads') OR
             (p_origin = 'organic' AND (c.referral_source IS NULL OR c.referral_source != 'meta_ads')))
    ),
    'this_week', (
      SELECT COUNT(DISTINCT c.id) 
      FROM conversations c 
      WHERE c.status IN ('open', 'pending')
        AND c.created_at >= week_start 
        AND c.created_at < week_start + INTERVAL '1 week' 
        AND (p_department_id IS NULL OR c.department_id = p_department_id) 
        AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
        AND (p_channel_id IS NULL OR c.channel_id = p_channel_id)
        AND (p_origin IS NULL OR p_origin = 'all' OR
             (p_origin = 'meta_ads' AND c.referral_source = 'meta_ads') OR
             (p_origin = 'organic' AND (c.referral_source IS NULL OR c.referral_source != 'meta_ads')))
    ),
    'last_week', (
      SELECT COUNT(DISTINCT c.id) 
      FROM conversations c 
      WHERE c.status IN ('open', 'pending')
        AND c.created_at >= last_week_start 
        AND c.created_at < week_start 
        AND (p_department_id IS NULL OR c.department_id = p_department_id) 
        AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
        AND (p_channel_id IS NULL OR c.channel_id = p_channel_id)
        AND (p_origin IS NULL OR p_origin = 'all' OR
             (p_origin = 'meta_ads' AND c.referral_source = 'meta_ads') OR
             (p_origin = 'organic' AND (c.referral_source IS NULL OR c.referral_source != 'meta_ads')))
    ),
    'this_month', (
      SELECT COUNT(DISTINCT c.id) 
      FROM conversations c 
      WHERE c.status IN ('open', 'pending')
        AND c.created_at >= month_start 
        AND c.created_at < month_start + INTERVAL '1 month' 
        AND (p_department_id IS NULL OR c.department_id = p_department_id) 
        AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
        AND (p_channel_id IS NULL OR c.channel_id = p_channel_id)
        AND (p_origin IS NULL OR p_origin = 'all' OR
             (p_origin = 'meta_ads' AND c.referral_source = 'meta_ads') OR
             (p_origin = 'organic' AND (c.referral_source IS NULL OR c.referral_source != 'meta_ads')))
    ),
    'last_month', (
      SELECT COUNT(DISTINCT c.id) 
      FROM conversations c 
      WHERE c.status IN ('open', 'pending')
        AND c.created_at >= last_month_start 
        AND c.created_at < month_start 
        AND (p_department_id IS NULL OR c.department_id = p_department_id) 
        AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
        AND (p_channel_id IS NULL OR c.channel_id = p_channel_id)
        AND (p_origin IS NULL OR p_origin = 'all' OR
             (p_origin = 'meta_ads' AND c.referral_source = 'meta_ads') OR
             (p_origin = 'organic' AND (c.referral_source IS NULL OR c.referral_source != 'meta_ads')))
    ),
    'all', (
      SELECT COUNT(DISTINCT c.id) 
      FROM conversations c 
      WHERE c.status IN ('open', 'pending')
        AND (p_department_id IS NULL OR c.department_id = p_department_id) 
        AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
        AND (p_channel_id IS NULL OR c.channel_id = p_channel_id)
        AND (p_origin IS NULL OR p_origin = 'all' OR
             (p_origin = 'meta_ads' AND c.referral_source = 'meta_ads') OR
             (p_origin = 'organic' AND (c.referral_source IS NULL OR c.referral_source != 'meta_ads')))
    )
  ) INTO result;

  RETURN result;
END;
$function$;

-- =====================================================
-- FASE 3: Criar RPC para métricas de leads retornantes
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_returning_leads_metrics(
  p_date_from timestamptz,
  p_date_to timestamptz,
  p_agent_id uuid DEFAULT NULL,
  p_department_id uuid DEFAULT NULL,
  p_channel_id uuid DEFAULT NULL
)
RETURNS TABLE (
  total_conversations bigint,
  new_contacts bigint,
  returning_contacts bigint,
  new_contact_rate numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH conversation_stats AS (
    SELECT 
      c.id as conv_id,
      c.contact_id,
      c.created_at as conv_created_at,
      ct.first_contact_at,
      -- Um contato é "novo" se first_contact_at está dentro do período filtrado
      CASE 
        WHEN ct.first_contact_at >= p_date_from AND ct.first_contact_at <= p_date_to 
        THEN true 
        ELSE false 
      END as is_new_contact
    FROM conversations c
    JOIN contacts ct ON ct.id = c.contact_id
    WHERE c.created_at >= p_date_from
      AND c.created_at <= p_date_to
      AND c.status IN ('open', 'pending', 'closed')
      AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
      AND (p_department_id IS NULL OR c.department_id = p_department_id)
      AND (p_channel_id IS NULL OR c.channel_id = p_channel_id)
  )
  SELECT 
    COUNT(DISTINCT conv_id)::bigint as total_conversations,
    COUNT(DISTINCT CASE WHEN is_new_contact THEN contact_id END)::bigint as new_contacts,
    COUNT(DISTINCT CASE WHEN NOT is_new_contact THEN contact_id END)::bigint as returning_contacts,
    CASE 
      WHEN COUNT(DISTINCT contact_id) > 0 
      THEN ROUND((COUNT(DISTINCT CASE WHEN is_new_contact THEN contact_id END)::numeric / COUNT(DISTINCT contact_id)::numeric) * 100, 1)
      ELSE 0 
    END as new_contact_rate
  FROM conversation_stats;
END;
$function$;
