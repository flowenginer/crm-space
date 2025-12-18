-- Corrigir get_leads_by_origin para usar conversations.created_at
CREATE OR REPLACE FUNCTION public.get_leads_by_origin(
  p_date_from timestamp with time zone,
  p_date_to timestamp with time zone,
  p_agent_id uuid DEFAULT NULL,
  p_department_id uuid DEFAULT NULL,
  p_conversion_status_names text[] DEFAULT ARRAY['Convertido', 'Fechado', 'Ganho', 'Won', 'Venda', '07 - Pedido Fechado']
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
        WHEN cv.referral_source = 'meta_ads' THEN 'meta_ads'
        WHEN cv.referral_source = 'linktree' THEN 'linktree'
        WHEN cv.referral_source = 'site' THEN 'site'
        WHEN ct.origin ILIKE '%indica%' OR ct.origin ILIKE '%referral%' THEN 'referral'
        WHEN ct.origin = 'manual' OR ct.origin = 'import' THEN 'manual'
        ELSE 'organic_unknown'
      END as detected_origin,
      ct.lead_status
    FROM contacts ct
    INNER JOIN conversations cv ON cv.contact_id = ct.id
    -- CORREÇÃO: Usar data de criação da CONVERSA (quando o lead entrou)
    WHERE cv.created_at >= p_date_from
      AND cv.created_at <= p_date_to
      AND (p_agent_id IS NULL OR cv.assigned_to = p_agent_id)
      AND (p_department_id IS NULL OR cv.department_id = p_department_id)
  ),
  unique_contacts AS (
    SELECT DISTINCT ON (contact_id)
      contact_id,
      detected_origin,
      lead_status
    FROM contact_origins
    ORDER BY contact_id, 
      CASE WHEN detected_origin = 'meta_ads' THEN 1 ELSE 2 END
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

-- Corrigir get_leads_distribution_by_agent para usar conversations.created_at
CREATE OR REPLACE FUNCTION public.get_leads_distribution_by_agent(
  p_date_from timestamp with time zone,
  p_date_to timestamp with time zone,
  p_origin text DEFAULT NULL
)
RETURNS TABLE(agent_id uuid, agent_name text, agent_avatar text, lead_count bigint, converted_count bigint, conversion_rate numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH contact_with_agent AS (
    SELECT DISTINCT ON (ct.id)
      ct.id as contact_id,
      cv.assigned_to as contact_agent_id,
      ct.lead_status,
      CASE
        WHEN cv.referral_source = 'meta_ads' THEN 'meta_ads'
        WHEN cv.referral_source = 'linktree' THEN 'linktree'
        WHEN cv.referral_source = 'site' THEN 'site'
        ELSE 'organic'
      END as detected_origin
    FROM contacts ct
    INNER JOIN conversations cv ON cv.contact_id = ct.id
    -- CORREÇÃO: Usar data de criação da CONVERSA
    WHERE cv.created_at >= p_date_from
      AND cv.created_at <= p_date_to
    ORDER BY ct.id, cv.created_at DESC NULLS LAST
  ),
  filtered_contacts AS (
    SELECT 
      cwa.contact_id, 
      cwa.contact_agent_id, 
      cwa.lead_status, 
      cwa.detected_origin
    FROM contact_with_agent cwa
    WHERE cwa.contact_agent_id IS NOT NULL
      AND (p_origin IS NULL OR cwa.detected_origin = p_origin)
  )
  SELECT
    pr.id as agent_id,
    pr.full_name as agent_name,
    pr.avatar_url as agent_avatar,
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
  FROM profiles pr
  INNER JOIN filtered_contacts fc ON fc.contact_agent_id = pr.id
  WHERE pr.is_active = true
  GROUP BY pr.id, pr.full_name, pr.avatar_url
  ORDER BY COUNT(fc.contact_id) DESC;
END;
$function$;

-- Corrigir get_date_filter_counts para usar conversations.created_at
CREATE OR REPLACE FUNCTION public.get_date_filter_counts(
  p_timezone text DEFAULT 'America/Sao_Paulo',
  p_department_id uuid DEFAULT NULL,
  p_agent_id uuid DEFAULT NULL,
  p_channel_id uuid DEFAULT NULL,
  p_origin text DEFAULT NULL
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

  -- CORREÇÃO: usar c.created_at (data da conversa) ao invés de ct.first_contact_at
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
    )
  ) INTO result;

  RETURN result;
END;
$function$;