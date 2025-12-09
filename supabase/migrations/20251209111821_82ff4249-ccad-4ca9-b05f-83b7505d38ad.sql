-- Force update get_date_filter_counts to use contact.first_contact_at
CREATE OR REPLACE FUNCTION public.get_date_filter_counts(
  p_timezone text DEFAULT 'America/Sao_Paulo'::text, 
  p_department_id uuid DEFAULT NULL::uuid, 
  p_agent_id uuid DEFAULT NULL::uuid, 
  p_channel_id text DEFAULT NULL::text, 
  p_origin text DEFAULT NULL::text, 
  p_status_filter text DEFAULT 'active'::text
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
  today_end TIMESTAMPTZ;
  yesterday_start TIMESTAMPTZ;
  yesterday_end TIMESTAMPTZ;
  week_start TIMESTAMPTZ;
  week_end TIMESTAMPTZ;
  last_week_start TIMESTAMPTZ;
  last_week_end TIMESTAMPTZ;
  month_start TIMESTAMPTZ;
  month_end TIMESTAMPTZ;
  last_month_start TIMESTAMPTZ;
  last_month_end TIMESTAMPTZ;
  v_channel_uuid uuid;
BEGIN
  -- Parse channel_id
  IF p_channel_id IS NOT NULL AND p_channel_id != 'no_channel' THEN
    BEGIN
      v_channel_uuid := p_channel_id::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_channel_uuid := NULL;
    END;
  END IF;

  -- Calculate date ranges in the specified timezone
  now_tz := NOW() AT TIME ZONE p_timezone;
  
  -- Today
  today_start := DATE_TRUNC('day', now_tz) AT TIME ZONE p_timezone;
  today_end := today_start + INTERVAL '1 day';
  
  -- Yesterday
  yesterday_start := today_start - INTERVAL '1 day';
  yesterday_end := today_start;
  
  -- This week (Monday to Sunday)
  week_start := DATE_TRUNC('week', now_tz) AT TIME ZONE p_timezone;
  week_end := week_start + INTERVAL '1 week';
  
  -- Last week
  last_week_start := week_start - INTERVAL '1 week';
  last_week_end := week_start;
  
  -- This month
  month_start := DATE_TRUNC('month', now_tz) AT TIME ZONE p_timezone;
  month_end := month_start + INTERVAL '1 month';
  
  -- Last month
  last_month_start := month_start - INTERVAL '1 month';
  last_month_end := month_start;
  
  -- USAR first_contact_at DO CONTATO em vez de created_at da conversa
  SELECT jsonb_build_object(
    'today', COUNT(*) FILTER (WHERE ct.first_contact_at >= today_start AND ct.first_contact_at < today_end),
    'yesterday', COUNT(*) FILTER (WHERE ct.first_contact_at >= yesterday_start AND ct.first_contact_at < yesterday_end),
    'thisWeek', COUNT(*) FILTER (WHERE ct.first_contact_at >= week_start AND ct.first_contact_at < week_end),
    'lastWeek', COUNT(*) FILTER (WHERE ct.first_contact_at >= last_week_start AND ct.first_contact_at < last_week_end),
    'thisMonth', COUNT(*) FILTER (WHERE ct.first_contact_at >= month_start AND ct.first_contact_at < month_end),
    'lastMonth', COUNT(*) FILTER (WHERE ct.first_contact_at >= last_month_start AND ct.first_contact_at < last_month_end)
  ) INTO result
  FROM conversations c
  INNER JOIN contacts ct ON ct.id = c.contact_id
  WHERE 
    -- Status filter
    (p_status_filter = 'all' OR 
     (p_status_filter = 'active' AND c.status IN ('open', 'pending')) OR
     (p_status_filter = 'closed' AND c.status = 'closed') OR
     c.status = p_status_filter)
    -- Optional filters
    AND (p_department_id IS NULL OR c.department_id = p_department_id)
    AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
    AND (p_channel_id IS NULL OR 
         (p_channel_id = 'no_channel' AND c.channel_id IS NULL) OR 
         c.channel_id = v_channel_uuid)
    AND (p_origin IS NULL OR p_origin = 'all' OR
         (p_origin = 'meta_ads' AND c.referral_source = 'meta_ads') OR
         (p_origin = 'organic' AND (c.referral_source IS NULL OR c.referral_source != 'meta_ads')));
  
  RETURN COALESCE(result, '{"today":0,"yesterday":0,"thisWeek":0,"lastWeek":0,"thisMonth":0,"lastMonth":0}'::jsonb);
END;
$function$;

-- Force update get_all_conversation_counts to use contact.first_contact_at
CREATE OR REPLACE FUNCTION public.get_all_conversation_counts(
  p_user_id uuid DEFAULT NULL::uuid, 
  p_timezone text DEFAULT 'America/Sao_Paulo'::text, 
  p_department_id uuid DEFAULT NULL::uuid, 
  p_agent_id uuid DEFAULT NULL::uuid, 
  p_channel_id text DEFAULT NULL::text, 
  p_origin text DEFAULT NULL::text, 
  p_date_filter text DEFAULT NULL::text, 
  p_status_filter text DEFAULT 'active'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result JSONB;
  date_start TIMESTAMPTZ;
  date_end TIMESTAMPTZ;
  now_tz TIMESTAMPTZ;
  today_start TIMESTAMPTZ;
  today_end TIMESTAMPTZ;
  yesterday_start TIMESTAMPTZ;
  yesterday_end TIMESTAMPTZ;
  week_start TIMESTAMPTZ;
  week_end TIMESTAMPTZ;
  last_week_start TIMESTAMPTZ;
  last_week_end TIMESTAMPTZ;
  month_start TIMESTAMPTZ;
  month_end TIMESTAMPTZ;
  last_month_start TIMESTAMPTZ;
  last_month_end TIMESTAMPTZ;
  v_channel_uuid uuid;
BEGIN
  now_tz := NOW() AT TIME ZONE p_timezone;
  
  -- Parse channel_id - handle 'no_channel' as special case
  IF p_channel_id IS NOT NULL AND p_channel_id != 'no_channel' THEN
    BEGIN
      v_channel_uuid := p_channel_id::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_channel_uuid := NULL;
    END;
  END IF;
  
  -- Calculate all date ranges
  today_start := DATE_TRUNC('day', now_tz) AT TIME ZONE p_timezone;
  today_end := today_start + INTERVAL '1 day';
  yesterday_start := today_start - INTERVAL '1 day';
  yesterday_end := today_start;
  week_start := DATE_TRUNC('week', now_tz) AT TIME ZONE p_timezone;
  week_end := week_start + INTERVAL '1 week';
  last_week_start := week_start - INTERVAL '1 week';
  last_week_end := week_start;
  month_start := DATE_TRUNC('month', now_tz) AT TIME ZONE p_timezone;
  month_end := month_start + INTERVAL '1 month';
  last_month_start := month_start - INTERVAL '1 month';
  last_month_end := month_start;
  
  -- Apply date filter if specified (uses first_contact_at)
  IF p_date_filter IS NOT NULL THEN
    CASE p_date_filter
      WHEN 'today' THEN date_start := today_start; date_end := today_end;
      WHEN 'yesterday' THEN date_start := yesterday_start; date_end := yesterday_end;
      WHEN 'this_week' THEN date_start := week_start; date_end := week_end;
      WHEN 'last_week' THEN date_start := last_week_start; date_end := last_week_end;
      WHEN 'this_month' THEN date_start := month_start; date_end := month_end;
      WHEN 'last_month' THEN date_start := last_month_start; date_end := last_month_end;
      ELSE date_start := NULL; date_end := NULL;
    END CASE;
  END IF;
  
  -- Usar JOIN com contacts e filtrar por first_contact_at
  WITH filtered_conversations AS (
    SELECT c.*
    FROM conversations c
    INNER JOIN contacts ct ON ct.id = c.contact_id
    WHERE 
      -- Status filter
      (p_status_filter = 'all' OR 
       (p_status_filter = 'active' AND c.status IN ('open', 'pending')) OR
       (p_status_filter = 'closed' AND c.status = 'closed') OR
       c.status = p_status_filter)
      -- Optional filters
      AND (p_department_id IS NULL OR c.department_id = p_department_id)
      AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
      -- Channel filter: handle 'no_channel' for NULL channels
      AND (p_channel_id IS NULL OR 
           (p_channel_id = 'no_channel' AND c.channel_id IS NULL) OR 
           c.channel_id = v_channel_uuid)
      AND (p_origin IS NULL OR p_origin = 'all' OR
           (p_origin = 'meta_ads' AND c.referral_source = 'meta_ads') OR
           (p_origin = 'organic' AND (c.referral_source IS NULL OR c.referral_source != 'meta_ads')))
      -- FILTRAR POR first_contact_at DO CONTATO (não created_at da conversa)
      AND (date_start IS NULL OR ct.first_contact_at >= date_start)
      AND (date_end IS NULL OR ct.first_contact_at < date_end)
  ),
  main_counts AS (
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE assigned_to = p_user_id) as mine,
      COUNT(*) FILTER (WHERE assigned_to IS NULL) as unassigned,
      COUNT(*) FILTER (WHERE is_unread = true) as unread
    FROM filtered_conversations
  ),
  channel_counts AS (
    SELECT jsonb_object_agg(COALESCE(channel_id::text, 'no_channel'), cnt) as counts
    FROM (
      SELECT channel_id, COUNT(*) as cnt
      FROM filtered_conversations
      GROUP BY channel_id
    ) sub
  ),
  dept_counts AS (
    SELECT jsonb_object_agg(department_id::text, cnt) as counts
    FROM (
      SELECT department_id, COUNT(*) as cnt
      FROM filtered_conversations
      WHERE department_id IS NOT NULL
      GROUP BY department_id
    ) sub
  ),
  agent_counts AS (
    SELECT jsonb_object_agg(assigned_to::text, cnt) as counts
    FROM (
      SELECT assigned_to, COUNT(*) as cnt
      FROM filtered_conversations
      WHERE assigned_to IS NOT NULL
      GROUP BY assigned_to
    ) sub
  ),
  origin_counts AS (
    SELECT 
      COUNT(*) FILTER (WHERE referral_source = 'meta_ads') as meta_ads,
      COUNT(*) FILTER (WHERE referral_source IS NULL OR referral_source != 'meta_ads') as organic
    FROM filtered_conversations
  ),
  -- Contar por first_contact_at do contato
  date_counts AS (
    SELECT 
      COUNT(*) FILTER (WHERE ct.first_contact_at >= today_start AND ct.first_contact_at < today_end) as today,
      COUNT(*) FILTER (WHERE ct.first_contact_at >= yesterday_start AND ct.first_contact_at < yesterday_end) as yesterday,
      COUNT(*) FILTER (WHERE ct.first_contact_at >= week_start AND ct.first_contact_at < week_end) as this_week,
      COUNT(*) FILTER (WHERE ct.first_contact_at >= last_week_start AND ct.first_contact_at < last_week_end) as last_week,
      COUNT(*) FILTER (WHERE ct.first_contact_at >= month_start AND ct.first_contact_at < month_end) as this_month,
      COUNT(*) FILTER (WHERE ct.first_contact_at >= last_month_start AND ct.first_contact_at < last_month_end) as last_month
    FROM conversations c
    INNER JOIN contacts ct ON ct.id = c.contact_id
    WHERE 
      (p_status_filter = 'all' OR 
       (p_status_filter = 'active' AND c.status IN ('open', 'pending')) OR
       c.status = p_status_filter)
      AND (p_department_id IS NULL OR c.department_id = p_department_id)
      AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
      AND (p_channel_id IS NULL OR 
           (p_channel_id = 'no_channel' AND c.channel_id IS NULL) OR 
           c.channel_id = v_channel_uuid)
      AND (p_origin IS NULL OR p_origin = 'all' OR
           (p_origin = 'meta_ads' AND c.referral_source = 'meta_ads') OR
           (p_origin = 'organic' AND (c.referral_source IS NULL OR c.referral_source != 'meta_ads')))
  )
  SELECT jsonb_build_object(
    'total', mc.total,
    'mine', mc.mine,
    'unassigned', mc.unassigned,
    'unread', mc.unread,
    'byChannel', COALESCE(cc.counts, '{}'::jsonb),
    'byDepartment', COALESCE(dc.counts, '{}'::jsonb),
    'byAgent', COALESCE(ac.counts, '{}'::jsonb),
    'byOrigin', jsonb_build_object('meta_ads', oc.meta_ads, 'organic', oc.organic),
    'byDate', jsonb_build_object(
      'today', dtc.today,
      'yesterday', dtc.yesterday,
      'thisWeek', dtc.this_week,
      'lastWeek', dtc.last_week,
      'thisMonth', dtc.this_month,
      'lastMonth', dtc.last_month
    )
  ) INTO result
  FROM main_counts mc
  CROSS JOIN channel_counts cc
  CROSS JOIN dept_counts dc
  CROSS JOIN agent_counts ac
  CROSS JOIN origin_counts oc
  CROSS JOIN date_counts dtc;
  
  RETURN COALESCE(result, '{
    "total": 0, "mine": 0, "unassigned": 0, "unread": 0,
    "byChannel": {}, "byDepartment": {}, "byAgent": {},
    "byOrigin": {"meta_ads": 0, "organic": 0},
    "byDate": {"today": 0, "yesterday": 0, "thisWeek": 0, "lastWeek": 0, "thisMonth": 0, "lastMonth": 0}
  }'::jsonb);
END;
$function$;