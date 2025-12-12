CREATE OR REPLACE FUNCTION public.get_all_conversation_counts(p_user_id uuid, p_department_id uuid DEFAULT NULL::uuid, p_agent_id uuid DEFAULT NULL::uuid, p_channel_id uuid DEFAULT NULL::uuid, p_origin text DEFAULT NULL::text, p_date_filter text DEFAULT NULL::text, p_status_filter text DEFAULT NULL::text, p_timezone text DEFAULT 'America/Sao_Paulo'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result JSONB;
  v_is_admin BOOLEAN;
  v_user_dept_ids UUID[];
  
  now_tz TIMESTAMPTZ;
  date_start TIMESTAMPTZ;
  date_end TIMESTAMPTZ;
  
  cnt_all BIGINT;
  cnt_mine BIGINT;
  cnt_unassigned BIGINT;
  cnt_unread BIGINT;
  
  channel_counts JSONB;
  date_counts JSONB;
  department_counts JSONB;
  origin_counts JSONB;
  
  today_start TIMESTAMPTZ;
  yesterday_start TIMESTAMPTZ;
  week_start TIMESTAMPTZ;
  last_week_start TIMESTAMPTZ;
  month_start TIMESTAMPTZ;
  last_month_start TIMESTAMPTZ;
BEGIN
  -- Check user role
  SELECT role IN ('admin', 'supervisor') INTO v_is_admin
  FROM profiles WHERE id = p_user_id;
  
  -- Get user departments
  SELECT array_agg(department_id) INTO v_user_dept_ids
  FROM user_departments WHERE user_id = p_user_id;
  
  now_tz := NOW() AT TIME ZONE p_timezone;
  
  -- Calculate date ranges for date filter
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

  -- Calculate date ranges for date counts
  today_start := DATE_TRUNC('day', now_tz) AT TIME ZONE p_timezone;
  yesterday_start := today_start - INTERVAL '1 day';
  week_start := DATE_TRUNC('week', now_tz) AT TIME ZONE p_timezone;
  last_week_start := week_start - INTERVAL '1 week';
  month_start := DATE_TRUNC('month', now_tz) AT TIME ZONE p_timezone;
  last_month_start := month_start - INTERVAL '1 month';

  -- Count ALL conversations (not unique contacts)
  SELECT COUNT(c.id) INTO cnt_all
  FROM conversations c
  WHERE c.status IN ('open', 'pending')
    AND (p_department_id IS NULL OR c.department_id = p_department_id)
    AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
    AND (p_channel_id IS NULL OR c.channel_id = p_channel_id)
    AND (p_origin IS NULL OR p_origin = 'all' OR
         (p_origin = 'meta_ads' AND c.referral_source = 'meta_ads') OR
         (p_origin = 'organic' AND (c.referral_source IS NULL OR c.referral_source != 'meta_ads')))
    AND (date_start IS NULL OR c.created_at >= date_start)
    AND (date_end IS NULL OR c.created_at < date_end)
    AND (p_status_filter IS NULL OR p_status_filter = 'all' OR p_status_filter = 'active' OR c.status = p_status_filter);

  -- Count MINE
  SELECT COUNT(c.id) INTO cnt_mine
  FROM conversations c
  WHERE c.status IN ('open', 'pending')
    AND c.assigned_to = p_user_id
    AND (p_department_id IS NULL OR c.department_id = p_department_id)
    AND (p_channel_id IS NULL OR c.channel_id = p_channel_id)
    AND (p_origin IS NULL OR p_origin = 'all' OR
         (p_origin = 'meta_ads' AND c.referral_source = 'meta_ads') OR
         (p_origin = 'organic' AND (c.referral_source IS NULL OR c.referral_source != 'meta_ads')))
    AND (date_start IS NULL OR c.created_at >= date_start)
    AND (date_end IS NULL OR c.created_at < date_end)
    AND (p_status_filter IS NULL OR p_status_filter = 'all' OR p_status_filter = 'active' OR c.status = p_status_filter);

  -- Count UNASSIGNED
  SELECT COUNT(c.id) INTO cnt_unassigned
  FROM conversations c
  WHERE c.status IN ('open', 'pending')
    AND c.assigned_to IS NULL
    AND (p_department_id IS NULL OR c.department_id = p_department_id)
    AND (p_channel_id IS NULL OR c.channel_id = p_channel_id)
    AND (p_origin IS NULL OR p_origin = 'all' OR
         (p_origin = 'meta_ads' AND c.referral_source = 'meta_ads') OR
         (p_origin = 'organic' AND (c.referral_source IS NULL OR c.referral_source != 'meta_ads')))
    AND (date_start IS NULL OR c.created_at >= date_start)
    AND (date_end IS NULL OR c.created_at < date_end)
    AND (p_status_filter IS NULL OR p_status_filter = 'all' OR p_status_filter = 'active' OR c.status = p_status_filter);

  -- Count UNREAD
  SELECT COUNT(c.id) INTO cnt_unread
  FROM conversations c
  WHERE c.status IN ('open', 'pending')
    AND c.is_unread = true
    AND (p_department_id IS NULL OR c.department_id = p_department_id)
    AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
    AND (p_channel_id IS NULL OR c.channel_id = p_channel_id)
    AND (p_origin IS NULL OR p_origin = 'all' OR
         (p_origin = 'meta_ads' AND c.referral_source = 'meta_ads') OR
         (p_origin = 'organic' AND (c.referral_source IS NULL OR c.referral_source != 'meta_ads')))
    AND (date_start IS NULL OR c.created_at >= date_start)
    AND (date_end IS NULL OR c.created_at < date_end)
    AND (p_status_filter IS NULL OR p_status_filter = 'all' OR p_status_filter = 'active' OR c.status = p_status_filter);

  -- Channel counts
  SELECT COALESCE(jsonb_object_agg(COALESCE(channel_id_str, 'no_channel'), cnt), '{}'::jsonb) INTO channel_counts
  FROM (
    SELECT COALESCE(c.channel_id::text, 'no_channel') as channel_id_str, COUNT(c.id) as cnt
    FROM conversations c
    WHERE c.status IN ('open', 'pending')
      AND (p_department_id IS NULL OR c.department_id = p_department_id)
      AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
      AND (p_origin IS NULL OR p_origin = 'all' OR
           (p_origin = 'meta_ads' AND c.referral_source = 'meta_ads') OR
           (p_origin = 'organic' AND (c.referral_source IS NULL OR c.referral_source != 'meta_ads')))
      AND (date_start IS NULL OR c.created_at >= date_start)
      AND (date_end IS NULL OR c.created_at < date_end)
      AND (p_status_filter IS NULL OR p_status_filter = 'all' OR p_status_filter = 'active' OR c.status = p_status_filter)
    GROUP BY COALESCE(c.channel_id::text, 'no_channel')
  ) sub;

  -- Department counts
  SELECT COALESCE(jsonb_object_agg(COALESCE(dept_id_str, 'no_department'), cnt), '{}'::jsonb) INTO department_counts
  FROM (
    SELECT COALESCE(c.department_id::text, 'no_department') as dept_id_str, COUNT(c.id) as cnt
    FROM conversations c
    WHERE c.status IN ('open', 'pending')
      AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
      AND (p_channel_id IS NULL OR c.channel_id = p_channel_id)
      AND (p_origin IS NULL OR p_origin = 'all' OR
           (p_origin = 'meta_ads' AND c.referral_source = 'meta_ads') OR
           (p_origin = 'organic' AND (c.referral_source IS NULL OR c.referral_source != 'meta_ads')))
      AND (date_start IS NULL OR c.created_at >= date_start)
      AND (date_end IS NULL OR c.created_at < date_end)
      AND (p_status_filter IS NULL OR p_status_filter = 'all' OR p_status_filter = 'active' OR c.status = p_status_filter)
    GROUP BY COALESCE(c.department_id::text, 'no_department')
  ) sub;

  -- Origin counts
  SELECT jsonb_build_object(
    'meta_ads', COALESCE(SUM(CASE WHEN c.referral_source = 'meta_ads' THEN 1 ELSE 0 END), 0),
    'organic', COALESCE(SUM(CASE WHEN c.referral_source IS NULL OR c.referral_source != 'meta_ads' THEN 1 ELSE 0 END), 0)
  ) INTO origin_counts
  FROM conversations c
  WHERE c.status IN ('open', 'pending')
    AND (p_department_id IS NULL OR c.department_id = p_department_id)
    AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
    AND (p_channel_id IS NULL OR c.channel_id = p_channel_id)
    AND (date_start IS NULL OR c.created_at >= date_start)
    AND (date_end IS NULL OR c.created_at < date_end)
    AND (p_status_filter IS NULL OR p_status_filter = 'all' OR p_status_filter = 'active' OR c.status = p_status_filter);

  -- Date counts - count conversations
  SELECT jsonb_build_object(
    'today', (
      SELECT COUNT(c.id) 
      FROM conversations c 
      WHERE c.status IN ('open', 'pending')
        AND c.created_at >= today_start 
        AND c.created_at < today_start + INTERVAL '1 day' 
        AND (p_department_id IS NULL OR c.department_id = p_department_id) 
        AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
    ),
    'yesterday', (
      SELECT COUNT(c.id) 
      FROM conversations c 
      WHERE c.status IN ('open', 'pending')
        AND c.created_at >= yesterday_start 
        AND c.created_at < today_start 
        AND (p_department_id IS NULL OR c.department_id = p_department_id) 
        AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
    ),
    'this_week', (
      SELECT COUNT(c.id) 
      FROM conversations c 
      WHERE c.status IN ('open', 'pending')
        AND c.created_at >= week_start 
        AND c.created_at < week_start + INTERVAL '1 week' 
        AND (p_department_id IS NULL OR c.department_id = p_department_id) 
        AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
    ),
    'last_week', (
      SELECT COUNT(c.id) 
      FROM conversations c 
      WHERE c.status IN ('open', 'pending')
        AND c.created_at >= last_week_start 
        AND c.created_at < week_start 
        AND (p_department_id IS NULL OR c.department_id = p_department_id) 
        AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
    ),
    'this_month', (
      SELECT COUNT(c.id) 
      FROM conversations c 
      WHERE c.status IN ('open', 'pending')
        AND c.created_at >= month_start 
        AND c.created_at < month_start + INTERVAL '1 month' 
        AND (p_department_id IS NULL OR c.department_id = p_department_id) 
        AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
    ),
    'last_month', (
      SELECT COUNT(c.id) 
      FROM conversations c 
      WHERE c.status IN ('open', 'pending')
        AND c.created_at >= last_month_start 
        AND c.created_at < month_start 
        AND (p_department_id IS NULL OR c.department_id = p_department_id) 
        AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
    )
  ) INTO date_counts;

  RETURN jsonb_build_object(
    'totals', jsonb_build_object(
      'all', COALESCE(cnt_all, 0),
      'mine', COALESCE(cnt_mine, 0),
      'unassigned', COALESCE(cnt_unassigned, 0),
      'unread', COALESCE(cnt_unread, 0),
      'pending', 0
    ),
    'channels', channel_counts,
    'dates', date_counts,
    'departments', department_counts,
    'origins', origin_counts
  );
END;
$function$;