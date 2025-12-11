-- Corrige a função get_leads_distribution_by_agent para usar:
-- 1. first_contact_at ao invés de created_at (consistente com página de Conversas)
-- 2. conversations.assigned_to ao invés de contacts.assigned_to (atribuição real)

CREATE OR REPLACE FUNCTION public.get_leads_distribution_by_agent(
  p_date_from TIMESTAMP WITH TIME ZONE,
  p_date_to TIMESTAMP WITH TIME ZONE,
  p_origin TEXT DEFAULT NULL
)
RETURNS TABLE (
  agent_id UUID,
  agent_name TEXT,
  agent_avatar TEXT,
  lead_count BIGINT,
  converted_count BIGINT,
  conversion_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH contact_conversations AS (
    -- Para cada contato, pega a conversa mais recente para determinar o agente responsável
    SELECT DISTINCT ON (ct.id)
      ct.id as contact_id,
      cv.assigned_to,
      ct.lead_status,
      CASE
        WHEN cv.referral_source = 'meta_ads' OR ct.origin = 'meta_ads' THEN 'meta_ads'
        WHEN cv.referral_source = 'linktree' OR ct.origin ILIKE '%linktree%' THEN 'linktree'
        WHEN cv.referral_source = 'site' OR ct.origin ILIKE '%site%' OR ct.origin ILIKE '%website%' THEN 'site'
        WHEN ct.origin ILIKE '%indica%' OR ct.origin ILIKE '%referral%' THEN 'referral'
        WHEN ct.origin = 'manual' OR ct.origin = 'import' THEN 'manual'
        ELSE 'organic'
      END as detected_origin
    FROM contacts ct
    INNER JOIN conversations cv ON cv.contact_id = ct.id
    WHERE ct.first_contact_at >= p_date_from
      AND ct.first_contact_at <= p_date_to
      AND cv.assigned_to IS NOT NULL
    ORDER BY ct.id, cv.last_message_at DESC NULLS LAST
  ),
  filtered_contacts AS (
    SELECT * FROM contact_conversations
    WHERE p_origin IS NULL OR detected_origin = p_origin
  )
  SELECT
    p.id as agent_id,
    p.full_name as agent_name,
    p.avatar_url as agent_avatar,
    COUNT(fc.contact_id)::BIGINT as lead_count,
    COUNT(fc.contact_id) FILTER (
      WHERE fc.lead_status IN ('Convertido', 'Fechado', 'Ganho', 'Won', 'Venda')
    )::BIGINT as converted_count,
    CASE 
      WHEN COUNT(fc.contact_id) > 0 
      THEN ROUND(
        (COUNT(*) FILTER (WHERE fc.lead_status IN ('Convertido', 'Fechado', 'Ganho', 'Won', 'Venda'))::NUMERIC 
        / COUNT(*)::NUMERIC) * 100, 1
      )
      ELSE 0
    END as conversion_rate
  FROM profiles p
  INNER JOIN filtered_contacts fc ON fc.assigned_to = p.id
  WHERE p.is_active = true
  GROUP BY p.id, p.full_name, p.avatar_url
  ORDER BY COUNT(fc.contact_id) DESC;
END;
$$;