-- 1. Atualizar get_leads_by_origin - usar apenas referral_source (critério estrito)
CREATE OR REPLACE FUNCTION public.get_leads_by_origin(
  p_date_from timestamp with time zone, 
  p_date_to timestamp with time zone, 
  p_agent_id uuid DEFAULT NULL::uuid, 
  p_department_id uuid DEFAULT NULL::uuid, 
  p_conversion_status_names text[] DEFAULT ARRAY['Convertido'::text, 'Fechado'::text, 'Ganho'::text, 'Won'::text]
)
RETURNS TABLE(origin text, total bigint, converted bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH contact_origins AS (
    SELECT
      ct.id as contact_id,
      CASE
        -- Meta Ads: APENAS quando conversa tem referral_source = 'meta_ads' (critério estrito)
        WHEN cv.referral_source = 'meta_ads' THEN 'meta_ads'
        -- Linktree
        WHEN cv.referral_source = 'linktree' THEN 'linktree'
        -- Site
        WHEN cv.referral_source = 'site' THEN 'site'
        -- Indicação
        WHEN ct.origin ILIKE '%indica%' OR ct.origin ILIKE '%referral%' THEN 'referral'
        -- Manual
        WHEN ct.origin = 'manual' OR ct.origin = 'import' THEN 'manual'
        -- Orgânico (outros)
        ELSE 'organic_unknown'
      END as detected_origin,
      ct.lead_status
    FROM contacts ct
    LEFT JOIN conversations cv ON cv.contact_id = ct.id
    -- Filtrar por data de CRIAÇÃO DO CONTATO (data de entrada do lead)
    WHERE ct.created_at >= p_date_from
      AND ct.created_at <= p_date_to
      AND (p_agent_id IS NULL OR ct.assigned_to = p_agent_id)
      AND (p_department_id IS NULL OR ct.department_id = p_department_id)
  ),
  unique_contacts AS (
    SELECT DISTINCT ON (contact_id)
      contact_id,
      detected_origin,
      lead_status
    FROM contact_origins
    ORDER BY contact_id, 
      CASE WHEN detected_origin = 'meta_ads' THEN 1 ELSE 2 END -- Prioriza meta_ads se tiver múltiplas conversas
  )
  SELECT
    uc.detected_origin as origin,
    COUNT(*)::bigint as total,
    COUNT(*) FILTER (WHERE uc.lead_status = ANY(p_conversion_status_names))::bigint as converted
  FROM unique_contacts uc
  GROUP BY uc.detected_origin
  ORDER BY total DESC;
END;
$function$;

-- 2. Atualizar get_leads_distribution_by_agent - usar contacts.created_at (first_contact_at)
CREATE OR REPLACE FUNCTION public.get_leads_distribution_by_agent(
  p_date_from timestamp with time zone, 
  p_date_to timestamp with time zone, 
  p_origin text DEFAULT NULL::text
)
RETURNS TABLE(
  agent_id uuid, 
  agent_name text, 
  agent_avatar text, 
  lead_count bigint, 
  converted_count bigint, 
  conversion_rate numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH contact_with_agent AS (
    -- Para cada contato, pega o agente atribuído e a origem via conversa
    SELECT DISTINCT ON (ct.id)
      ct.id as contact_id,
      COALESCE(ct.assigned_to, cv.assigned_to) as agent_id,
      ct.lead_status,
      CASE
        WHEN cv.referral_source = 'meta_ads' THEN 'meta_ads'
        WHEN cv.referral_source = 'linktree' THEN 'linktree'
        WHEN cv.referral_source = 'site' THEN 'site'
        ELSE 'organic'
      END as detected_origin
    FROM contacts ct
    LEFT JOIN conversations cv ON cv.contact_id = ct.id
    -- Filtrar por data de CRIAÇÃO DO CONTATO (data de entrada)
    WHERE ct.created_at >= p_date_from
      AND ct.created_at <= p_date_to
    ORDER BY ct.id, cv.last_message_at DESC NULLS LAST
  ),
  filtered_contacts AS (
    SELECT * FROM contact_with_agent
    WHERE agent_id IS NOT NULL
      AND (p_origin IS NULL OR detected_origin = p_origin)
  )
  SELECT
    p.id as agent_id,
    p.full_name as agent_name,
    p.avatar_url as agent_avatar,
    COUNT(fc.contact_id)::BIGINT as lead_count,
    COUNT(fc.contact_id) FILTER (
      WHERE fc.lead_status IN ('Convertido', 'Fechado', 'Ganho', 'Won', 'Venda', '07 - Pedido Fechado')
    )::BIGINT as converted_count,
    CASE 
      WHEN COUNT(fc.contact_id) > 0 
      THEN ROUND(
        (COUNT(*) FILTER (WHERE fc.lead_status IN ('Convertido', 'Fechado', 'Ganho', 'Won', 'Venda', '07 - Pedido Fechado'))::NUMERIC 
        / COUNT(*)::NUMERIC) * 100, 1
      )
      ELSE 0
    END as conversion_rate
  FROM profiles p
  INNER JOIN filtered_contacts fc ON fc.agent_id = p.id
  WHERE p.is_active = true
  GROUP BY p.id, p.full_name, p.avatar_url
  ORDER BY COUNT(fc.contact_id) DESC;
END;
$function$;