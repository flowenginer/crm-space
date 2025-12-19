-- Criar versão unificada de get_returning_leads_metrics com TODOS os 6 parâmetros
-- Esta função retorna Novos Contatos (contatos únicos) e Retornantes

-- Primeiro, remover versões antigas para evitar ambiguidade
DROP FUNCTION IF EXISTS public.get_returning_leads_metrics(timestamp with time zone, timestamp with time zone, uuid, uuid, text);
DROP FUNCTION IF EXISTS public.get_returning_leads_metrics(timestamp with time zone, timestamp with time zone, uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.get_returning_leads_metrics(timestamp with time zone, timestamp with time zone, uuid, uuid, uuid, text);

-- Criar função unificada
CREATE OR REPLACE FUNCTION public.get_returning_leads_metrics(
  p_date_from timestamp with time zone, 
  p_date_to timestamp with time zone, 
  p_agent_id uuid DEFAULT NULL::uuid, 
  p_department_id uuid DEFAULT NULL::uuid, 
  p_channel_id uuid DEFAULT NULL::uuid,
  p_origin text DEFAULT NULL::text
)
RETURNS TABLE(
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
  WITH base_conversations AS (
    SELECT 
      c.id as conversation_id,
      c.contact_id,
      ct.first_contact_at
    FROM conversations c
    INNER JOIN contacts ct ON ct.id = c.contact_id
    WHERE c.created_at >= p_date_from
      AND c.created_at <= p_date_to
      AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
      AND (p_department_id IS NULL OR c.department_id = p_department_id)
      AND (p_channel_id IS NULL OR c.channel_id = p_channel_id)
      AND (
        p_origin IS NULL OR p_origin = 'all'
        OR (p_origin = 'meta_ads' AND c.referral_source = 'meta_ads')
        OR (p_origin = 'linktree' AND c.referral_source = 'linktree')
        OR (p_origin = 'site' AND c.referral_source = 'site')
        OR (p_origin = 'manual' AND (ct.origin = 'manual' OR ct.origin = 'import'))
        OR (p_origin = 'referral' AND (ct.origin ILIKE '%indica%' OR ct.origin ILIKE '%referral%'))
        OR (p_origin = 'organic_unknown' AND (
          c.referral_source IS NULL OR c.referral_source NOT IN ('meta_ads', 'linktree', 'site')
        ) AND NOT (ct.origin = 'manual' OR ct.origin = 'import')
          AND NOT (ct.origin ILIKE '%indica%' OR ct.origin ILIKE '%referral%'))
        OR (p_origin = 'organic' AND (c.referral_source IS NULL OR c.referral_source != 'meta_ads'))
      )
  ),
  -- Contatos únicos novos (first_contact_at dentro do período)
  new_unique_contacts AS (
    SELECT DISTINCT contact_id
    FROM base_conversations bc
    WHERE bc.first_contact_at >= p_date_from
      AND bc.first_contact_at <= p_date_to
  ),
  -- Contatos únicos retornantes (first_contact_at ANTES do período)
  returning_unique_contacts AS (
    SELECT DISTINCT contact_id
    FROM base_conversations bc
    WHERE bc.first_contact_at IS NOT NULL 
      AND bc.first_contact_at < p_date_from
  ),
  metrics AS (
    SELECT
      COUNT(*)::BIGINT as total_conv,
      (SELECT COUNT(*) FROM new_unique_contacts)::BIGINT as new_cont,
      (SELECT COUNT(*) FROM returning_unique_contacts)::BIGINT as returning_cont
  )
  SELECT
    m.total_conv as total_conversations,
    m.new_cont as new_contacts,
    m.returning_cont as returning_contacts,
    CASE 
      WHEN (m.new_cont + m.returning_cont) > 0 
      THEN ROUND((m.new_cont::NUMERIC / (m.new_cont + m.returning_cont)::NUMERIC) * 100, 1)
      ELSE 0
    END as new_contact_rate
  FROM metrics m;
END;
$function$;