-- Function to get date filter counts with proper timezone handling
CREATE OR REPLACE FUNCTION get_date_filter_counts(
  p_timezone TEXT DEFAULT 'America/Sao_Paulo',
  p_department_id UUID DEFAULT NULL,
  p_agent_id UUID DEFAULT NULL,
  p_channel_id UUID DEFAULT NULL,
  p_origin TEXT DEFAULT NULL,
  p_status_filter TEXT DEFAULT 'active'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
BEGIN
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
  
  SELECT jsonb_build_object(
    'today', COUNT(*) FILTER (WHERE c.created_at >= today_start AND c.created_at < today_end),
    'yesterday', COUNT(*) FILTER (WHERE c.created_at >= yesterday_start AND c.created_at < yesterday_end),
    'thisWeek', COUNT(*) FILTER (WHERE c.created_at >= week_start AND c.created_at < week_end),
    'lastWeek', COUNT(*) FILTER (WHERE c.created_at >= last_week_start AND c.created_at < last_week_end),
    'thisMonth', COUNT(*) FILTER (WHERE c.created_at >= month_start AND c.created_at < month_end),
    'lastMonth', COUNT(*) FILTER (WHERE c.created_at >= last_month_start AND c.created_at < last_month_end)
  ) INTO result
  FROM conversations c
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
         c.channel_id = p_channel_id::uuid)
    AND (p_origin IS NULL OR p_origin = 'all' OR
         (p_origin = 'meta_ads' AND c.referral_source = 'meta_ads') OR
         (p_origin = 'organic' AND (c.referral_source IS NULL OR c.referral_source != 'meta_ads')));
  
  RETURN COALESCE(result, '{"today":0,"yesterday":0,"thisWeek":0,"lastWeek":0,"thisMonth":0,"lastMonth":0}'::jsonb);
END;
$$;

-- Function to get channel counts with filters
CREATE OR REPLACE FUNCTION get_channel_counts(
  p_department_id UUID DEFAULT NULL,
  p_agent_id UUID DEFAULT NULL,
  p_origin TEXT DEFAULT NULL,
  p_date_filter TEXT DEFAULT NULL,
  p_timezone TEXT DEFAULT 'America/Sao_Paulo'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
  date_start TIMESTAMPTZ;
  date_end TIMESTAMPTZ;
  now_tz TIMESTAMPTZ;
BEGIN
  now_tz := NOW() AT TIME ZONE p_timezone;
  
  -- Calculate date range if filter is set
  IF p_date_filter IS NOT NULL THEN
    CASE p_date_filter
      WHEN 'today' THEN
        date_start := DATE_TRUNC('day', now_tz) AT TIME ZONE p_timezone;
        date_end := date_start + INTERVAL '1 day';
      WHEN 'yesterday' THEN
        date_start := DATE_TRUNC('day', now_tz) AT TIME ZONE p_timezone - INTERVAL '1 day';
        date_end := DATE_TRUNC('day', now_tz) AT TIME ZONE p_timezone;
      WHEN 'this_week' THEN
        date_start := DATE_TRUNC('week', now_tz) AT TIME ZONE p_timezone;
        date_end := date_start + INTERVAL '1 week';
      WHEN 'last_week' THEN
        date_start := DATE_TRUNC('week', now_tz) AT TIME ZONE p_timezone - INTERVAL '1 week';
        date_end := DATE_TRUNC('week', now_tz) AT TIME ZONE p_timezone;
      WHEN 'this_month' THEN
        date_start := DATE_TRUNC('month', now_tz) AT TIME ZONE p_timezone;
        date_end := date_start + INTERVAL '1 month';
      WHEN 'last_month' THEN
        date_start := DATE_TRUNC('month', now_tz) AT TIME ZONE p_timezone - INTERVAL '1 month';
        date_end := DATE_TRUNC('month', now_tz) AT TIME ZONE p_timezone;
      ELSE
        date_start := NULL;
        date_end := NULL;
    END CASE;
  END IF;
  
  SELECT jsonb_object_agg(
    COALESCE(channel_id::text, 'no_channel'),
    cnt
  ) INTO result
  FROM (
    SELECT c.channel_id, COUNT(*) as cnt
    FROM conversations c
    WHERE c.status IN ('open', 'pending')
      AND (p_department_id IS NULL OR c.department_id = p_department_id)
      AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
      AND (p_origin IS NULL OR p_origin = 'all' OR
           (p_origin = 'meta_ads' AND c.referral_source = 'meta_ads') OR
           (p_origin = 'organic' AND (c.referral_source IS NULL OR c.referral_source != 'meta_ads')))
      AND (date_start IS NULL OR c.created_at >= date_start)
      AND (date_end IS NULL OR c.created_at < date_end)
    GROUP BY c.channel_id
  ) sub;
  
  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;

-- Function to get department counts with filters
CREATE OR REPLACE FUNCTION get_department_counts(
  p_agent_id UUID DEFAULT NULL,
  p_channel_id UUID DEFAULT NULL,
  p_origin TEXT DEFAULT NULL,
  p_date_filter TEXT DEFAULT NULL,
  p_timezone TEXT DEFAULT 'America/Sao_Paulo'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
  date_start TIMESTAMPTZ;
  date_end TIMESTAMPTZ;
  now_tz TIMESTAMPTZ;
BEGIN
  now_tz := NOW() AT TIME ZONE p_timezone;
  
  IF p_date_filter IS NOT NULL THEN
    CASE p_date_filter
      WHEN 'today' THEN
        date_start := DATE_TRUNC('day', now_tz) AT TIME ZONE p_timezone;
        date_end := date_start + INTERVAL '1 day';
      WHEN 'yesterday' THEN
        date_start := DATE_TRUNC('day', now_tz) AT TIME ZONE p_timezone - INTERVAL '1 day';
        date_end := DATE_TRUNC('day', now_tz) AT TIME ZONE p_timezone;
      WHEN 'this_week' THEN
        date_start := DATE_TRUNC('week', now_tz) AT TIME ZONE p_timezone;
        date_end := date_start + INTERVAL '1 week';
      WHEN 'last_week' THEN
        date_start := DATE_TRUNC('week', now_tz) AT TIME ZONE p_timezone - INTERVAL '1 week';
        date_end := DATE_TRUNC('week', now_tz) AT TIME ZONE p_timezone;
      WHEN 'this_month' THEN
        date_start := DATE_TRUNC('month', now_tz) AT TIME ZONE p_timezone;
        date_end := date_start + INTERVAL '1 month';
      WHEN 'last_month' THEN
        date_start := DATE_TRUNC('month', now_tz) AT TIME ZONE p_timezone - INTERVAL '1 month';
        date_end := DATE_TRUNC('month', now_tz) AT TIME ZONE p_timezone;
      ELSE
        date_start := NULL;
        date_end := NULL;
    END CASE;
  END IF;
  
  SELECT jsonb_object_agg(department_id::text, cnt) INTO result
  FROM (
    SELECT c.department_id, COUNT(*) as cnt
    FROM conversations c
    WHERE c.status IN ('open', 'pending')
      AND c.department_id IS NOT NULL
      AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
      AND (p_channel_id IS NULL OR c.channel_id = p_channel_id)
      AND (p_origin IS NULL OR p_origin = 'all' OR
           (p_origin = 'meta_ads' AND c.referral_source = 'meta_ads') OR
           (p_origin = 'organic' AND (c.referral_source IS NULL OR c.referral_source != 'meta_ads')))
      AND (date_start IS NULL OR c.created_at >= date_start)
      AND (date_end IS NULL OR c.created_at < date_end)
    GROUP BY c.department_id
  ) sub;
  
  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;

-- Function to get origin counts with filters
CREATE OR REPLACE FUNCTION get_origin_counts(
  p_department_id UUID DEFAULT NULL,
  p_agent_id UUID DEFAULT NULL,
  p_channel_id UUID DEFAULT NULL,
  p_date_filter TEXT DEFAULT NULL,
  p_timezone TEXT DEFAULT 'America/Sao_Paulo'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
  meta_count BIGINT;
  organic_count BIGINT;
  date_start TIMESTAMPTZ;
  date_end TIMESTAMPTZ;
  now_tz TIMESTAMPTZ;
BEGIN
  now_tz := NOW() AT TIME ZONE p_timezone;
  
  IF p_date_filter IS NOT NULL THEN
    CASE p_date_filter
      WHEN 'today' THEN
        date_start := DATE_TRUNC('day', now_tz) AT TIME ZONE p_timezone;
        date_end := date_start + INTERVAL '1 day';
      WHEN 'yesterday' THEN
        date_start := DATE_TRUNC('day', now_tz) AT TIME ZONE p_timezone - INTERVAL '1 day';
        date_end := DATE_TRUNC('day', now_tz) AT TIME ZONE p_timezone;
      WHEN 'this_week' THEN
        date_start := DATE_TRUNC('week', now_tz) AT TIME ZONE p_timezone;
        date_end := date_start + INTERVAL '1 week';
      WHEN 'last_week' THEN
        date_start := DATE_TRUNC('week', now_tz) AT TIME ZONE p_timezone - INTERVAL '1 week';
        date_end := DATE_TRUNC('week', now_tz) AT TIME ZONE p_timezone;
      WHEN 'this_month' THEN
        date_start := DATE_TRUNC('month', now_tz) AT TIME ZONE p_timezone;
        date_end := date_start + INTERVAL '1 month';
      WHEN 'last_month' THEN
        date_start := DATE_TRUNC('month', now_tz) AT TIME ZONE p_timezone - INTERVAL '1 month';
        date_end := DATE_TRUNC('month', now_tz) AT TIME ZONE p_timezone;
      ELSE
        date_start := NULL;
        date_end := NULL;
    END CASE;
  END IF;
  
  SELECT 
    COUNT(*) FILTER (WHERE c.referral_source = 'meta_ads'),
    COUNT(*) FILTER (WHERE c.referral_source IS NULL OR c.referral_source != 'meta_ads')
  INTO meta_count, organic_count
  FROM conversations c
  WHERE c.status IN ('open', 'pending')
    AND (p_department_id IS NULL OR c.department_id = p_department_id)
    AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
    AND (p_channel_id IS NULL OR c.channel_id = p_channel_id)
    AND (date_start IS NULL OR c.created_at >= date_start)
    AND (date_end IS NULL OR c.created_at < date_end);
  
  RETURN jsonb_build_object('meta_ads', COALESCE(meta_count, 0), 'organic', COALESCE(organic_count, 0));
END;
$$;

-- Function to get agent counts with filters  
CREATE OR REPLACE FUNCTION get_agent_counts(
  p_department_id UUID DEFAULT NULL,
  p_channel_id UUID DEFAULT NULL,
  p_origin TEXT DEFAULT NULL,
  p_date_filter TEXT DEFAULT NULL,
  p_timezone TEXT DEFAULT 'America/Sao_Paulo'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
  date_start TIMESTAMPTZ;
  date_end TIMESTAMPTZ;
  now_tz TIMESTAMPTZ;
BEGIN
  now_tz := NOW() AT TIME ZONE p_timezone;
  
  IF p_date_filter IS NOT NULL THEN
    CASE p_date_filter
      WHEN 'today' THEN
        date_start := DATE_TRUNC('day', now_tz) AT TIME ZONE p_timezone;
        date_end := date_start + INTERVAL '1 day';
      WHEN 'yesterday' THEN
        date_start := DATE_TRUNC('day', now_tz) AT TIME ZONE p_timezone - INTERVAL '1 day';
        date_end := DATE_TRUNC('day', now_tz) AT TIME ZONE p_timezone;
      WHEN 'this_week' THEN
        date_start := DATE_TRUNC('week', now_tz) AT TIME ZONE p_timezone;
        date_end := date_start + INTERVAL '1 week';
      WHEN 'last_week' THEN
        date_start := DATE_TRUNC('week', now_tz) AT TIME ZONE p_timezone - INTERVAL '1 week';
        date_end := DATE_TRUNC('week', now_tz) AT TIME ZONE p_timezone;
      WHEN 'this_month' THEN
        date_start := DATE_TRUNC('month', now_tz) AT TIME ZONE p_timezone;
        date_end := date_start + INTERVAL '1 month';
      WHEN 'last_month' THEN
        date_start := DATE_TRUNC('month', now_tz) AT TIME ZONE p_timezone - INTERVAL '1 month';
        date_end := DATE_TRUNC('month', now_tz) AT TIME ZONE p_timezone;
      ELSE
        date_start := NULL;
        date_end := NULL;
    END CASE;
  END IF;
  
  SELECT jsonb_object_agg(assigned_to::text, cnt) INTO result
  FROM (
    SELECT c.assigned_to, COUNT(*) as cnt
    FROM conversations c
    WHERE c.status IN ('open', 'pending')
      AND c.assigned_to IS NOT NULL
      AND (p_department_id IS NULL OR c.department_id = p_department_id)
      AND (p_channel_id IS NULL OR c.channel_id = p_channel_id)
      AND (p_origin IS NULL OR p_origin = 'all' OR
           (p_origin = 'meta_ads' AND c.referral_source = 'meta_ads') OR
           (p_origin = 'organic' AND (c.referral_source IS NULL OR c.referral_source != 'meta_ads')))
      AND (date_start IS NULL OR c.created_at >= date_start)
      AND (date_end IS NULL OR c.created_at < date_end)
    GROUP BY c.assigned_to
  ) sub;
  
  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;

-- Main consolidated function to get ALL counts in one call
CREATE OR REPLACE FUNCTION get_all_conversation_counts(
  p_user_id UUID DEFAULT NULL,
  p_timezone TEXT DEFAULT 'America/Sao_Paulo',
  p_department_id UUID DEFAULT NULL,
  p_agent_id UUID DEFAULT NULL,
  p_channel_id UUID DEFAULT NULL,
  p_origin TEXT DEFAULT NULL,
  p_date_filter TEXT DEFAULT NULL,
  p_status_filter TEXT DEFAULT 'active'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
BEGIN
  now_tz := NOW() AT TIME ZONE p_timezone;
  
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
  
  -- Apply date filter if specified
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
  
  WITH filtered_conversations AS (
    SELECT c.*
    FROM conversations c
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
           (p_channel_id = 'no_channel'::uuid AND c.channel_id IS NULL) OR 
           c.channel_id = p_channel_id)
      AND (p_origin IS NULL OR p_origin = 'all' OR
           (p_origin = 'meta_ads' AND c.referral_source = 'meta_ads') OR
           (p_origin = 'organic' AND (c.referral_source IS NULL OR c.referral_source != 'meta_ads')))
      AND (date_start IS NULL OR c.created_at >= date_start)
      AND (date_end IS NULL OR c.created_at < date_end)
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
  date_counts AS (
    SELECT 
      COUNT(*) FILTER (WHERE created_at >= today_start AND created_at < today_end) as today,
      COUNT(*) FILTER (WHERE created_at >= yesterday_start AND created_at < yesterday_end) as yesterday,
      COUNT(*) FILTER (WHERE created_at >= week_start AND created_at < week_end) as this_week,
      COUNT(*) FILTER (WHERE created_at >= last_week_start AND created_at < last_week_end) as last_week,
      COUNT(*) FILTER (WHERE created_at >= month_start AND created_at < month_end) as this_month,
      COUNT(*) FILTER (WHERE created_at >= last_month_start AND created_at < last_month_end) as last_month
    FROM conversations c
    WHERE 
      (p_status_filter = 'all' OR 
       (p_status_filter = 'active' AND c.status IN ('open', 'pending')) OR
       c.status = p_status_filter)
      AND (p_department_id IS NULL OR c.department_id = p_department_id)
      AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
      AND (p_channel_id IS NULL OR c.channel_id = p_channel_id)
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
$$;