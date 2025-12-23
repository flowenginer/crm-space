-- CRITICAL FIX: Add tenant_id filtering to ALL SECURITY DEFINER RPC functions
-- This prevents data leakage between tenants

-- 1. Fix get_all_conversation_counts
CREATE OR REPLACE FUNCTION public.get_all_conversation_counts(
  p_user_id uuid, 
  p_department_id uuid DEFAULT NULL::uuid, 
  p_agent_id uuid DEFAULT NULL::uuid, 
  p_channel_id uuid DEFAULT NULL::uuid, 
  p_origin text DEFAULT NULL::text, 
  p_date_filter text DEFAULT NULL::text, 
  p_status_filter text DEFAULT NULL::text, 
  p_timezone text DEFAULT 'America/Sao_Paulo'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result JSONB;
  v_is_admin BOOLEAN;
  v_user_dept_ids UUID[];
  v_user_tenant UUID;
  
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
  -- CRITICAL: Get user's tenant_id for isolation
  v_user_tenant := get_user_tenant_id();
  IF v_user_tenant IS NULL THEN
    RETURN jsonb_build_object('error', 'no_tenant');
  END IF;

  -- Check user role
  SELECT role IN ('admin', 'supervisor') INTO v_is_admin
  FROM profiles WHERE id = p_user_id AND tenant_id = v_user_tenant;
  
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

  -- Count ALL conversations with TENANT FILTER
  SELECT COUNT(c.id) INTO cnt_all
  FROM conversations c
  WHERE c.tenant_id = v_user_tenant
    AND c.status IN ('open', 'pending')
    AND (p_department_id IS NULL OR c.department_id = p_department_id)
    AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
    AND (p_channel_id IS NULL OR c.channel_id = p_channel_id)
    AND (p_origin IS NULL OR p_origin = 'all' OR
         (p_origin = 'meta_ads' AND c.referral_source = 'meta_ads') OR
         (p_origin = 'organic' AND (c.referral_source IS NULL OR c.referral_source != 'meta_ads')))
    AND (date_start IS NULL OR c.created_at >= date_start)
    AND (date_end IS NULL OR c.created_at < date_end)
    AND (p_status_filter IS NULL OR p_status_filter = 'all' OR p_status_filter = 'active' OR c.status = p_status_filter);

  -- Count MINE with TENANT FILTER
  SELECT COUNT(c.id) INTO cnt_mine
  FROM conversations c
  WHERE c.tenant_id = v_user_tenant
    AND c.status IN ('open', 'pending')
    AND c.assigned_to = p_user_id
    AND (p_department_id IS NULL OR c.department_id = p_department_id)
    AND (p_channel_id IS NULL OR c.channel_id = p_channel_id)
    AND (p_origin IS NULL OR p_origin = 'all' OR
         (p_origin = 'meta_ads' AND c.referral_source = 'meta_ads') OR
         (p_origin = 'organic' AND (c.referral_source IS NULL OR c.referral_source != 'meta_ads')))
    AND (date_start IS NULL OR c.created_at >= date_start)
    AND (date_end IS NULL OR c.created_at < date_end)
    AND (p_status_filter IS NULL OR p_status_filter = 'all' OR p_status_filter = 'active' OR c.status = p_status_filter);

  -- Count UNASSIGNED with TENANT FILTER
  SELECT COUNT(c.id) INTO cnt_unassigned
  FROM conversations c
  WHERE c.tenant_id = v_user_tenant
    AND c.status IN ('open', 'pending')
    AND c.assigned_to IS NULL
    AND (p_department_id IS NULL OR c.department_id = p_department_id)
    AND (p_channel_id IS NULL OR c.channel_id = p_channel_id)
    AND (p_origin IS NULL OR p_origin = 'all' OR
         (p_origin = 'meta_ads' AND c.referral_source = 'meta_ads') OR
         (p_origin = 'organic' AND (c.referral_source IS NULL OR c.referral_source != 'meta_ads')))
    AND (date_start IS NULL OR c.created_at >= date_start)
    AND (date_end IS NULL OR c.created_at < date_end)
    AND (p_status_filter IS NULL OR p_status_filter = 'all' OR p_status_filter = 'active' OR c.status = p_status_filter);

  -- Count UNREAD with TENANT FILTER
  SELECT COUNT(c.id) INTO cnt_unread
  FROM conversations c
  WHERE c.tenant_id = v_user_tenant
    AND c.status IN ('open', 'pending')
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

  -- Channel counts with TENANT FILTER
  SELECT COALESCE(jsonb_object_agg(COALESCE(channel_id_str, 'no_channel'), cnt), '{}'::jsonb) INTO channel_counts
  FROM (
    SELECT COALESCE(c.channel_id::text, 'no_channel') as channel_id_str, COUNT(c.id) as cnt
    FROM conversations c
    WHERE c.tenant_id = v_user_tenant
      AND c.status IN ('open', 'pending')
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

  -- Department counts with TENANT FILTER
  SELECT COALESCE(jsonb_object_agg(COALESCE(dept_id_str, 'no_department'), cnt), '{}'::jsonb) INTO department_counts
  FROM (
    SELECT COALESCE(c.department_id::text, 'no_department') as dept_id_str, COUNT(c.id) as cnt
    FROM conversations c
    WHERE c.tenant_id = v_user_tenant
      AND c.status IN ('open', 'pending')
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

  -- Origin counts with TENANT FILTER
  SELECT jsonb_build_object(
    'meta_ads', COALESCE(SUM(CASE WHEN c.referral_source = 'meta_ads' THEN 1 ELSE 0 END), 0),
    'organic', COALESCE(SUM(CASE WHEN c.referral_source IS NULL OR c.referral_source != 'meta_ads' THEN 1 ELSE 0 END), 0)
  ) INTO origin_counts
  FROM conversations c
  WHERE c.tenant_id = v_user_tenant
    AND c.status IN ('open', 'pending')
    AND (p_department_id IS NULL OR c.department_id = p_department_id)
    AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
    AND (p_channel_id IS NULL OR c.channel_id = p_channel_id)
    AND (date_start IS NULL OR c.created_at >= date_start)
    AND (date_end IS NULL OR c.created_at < date_end)
    AND (p_status_filter IS NULL OR p_status_filter = 'all' OR p_status_filter = 'active' OR c.status = p_status_filter);

  -- Date counts with TENANT FILTER
  SELECT jsonb_build_object(
    'today', (
      SELECT COUNT(c.id) 
      FROM conversations c 
      WHERE c.tenant_id = v_user_tenant
        AND c.status IN ('open', 'pending')
        AND c.created_at >= today_start 
        AND c.created_at < today_start + INTERVAL '1 day' 
        AND (p_department_id IS NULL OR c.department_id = p_department_id) 
        AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
    ),
    'yesterday', (
      SELECT COUNT(c.id) 
      FROM conversations c 
      WHERE c.tenant_id = v_user_tenant
        AND c.status IN ('open', 'pending')
        AND c.created_at >= yesterday_start 
        AND c.created_at < today_start 
        AND (p_department_id IS NULL OR c.department_id = p_department_id) 
        AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
    ),
    'this_week', (
      SELECT COUNT(c.id) 
      FROM conversations c 
      WHERE c.tenant_id = v_user_tenant
        AND c.status IN ('open', 'pending')
        AND c.created_at >= week_start 
        AND c.created_at < week_start + INTERVAL '1 week' 
        AND (p_department_id IS NULL OR c.department_id = p_department_id) 
        AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
    ),
    'last_week', (
      SELECT COUNT(c.id) 
      FROM conversations c 
      WHERE c.tenant_id = v_user_tenant
        AND c.status IN ('open', 'pending')
        AND c.created_at >= last_week_start 
        AND c.created_at < week_start 
        AND (p_department_id IS NULL OR c.department_id = p_department_id) 
        AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
    ),
    'this_month', (
      SELECT COUNT(c.id) 
      FROM conversations c 
      WHERE c.tenant_id = v_user_tenant
        AND c.status IN ('open', 'pending')
        AND c.created_at >= month_start 
        AND c.created_at < month_start + INTERVAL '1 month' 
        AND (p_department_id IS NULL OR c.department_id = p_department_id) 
        AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
    ),
    'last_month', (
      SELECT COUNT(c.id) 
      FROM conversations c 
      WHERE c.tenant_id = v_user_tenant
        AND c.status IN ('open', 'pending')
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

-- 2. Fix get_channel_counts
CREATE OR REPLACE FUNCTION public.get_channel_counts(
  p_department_id uuid DEFAULT NULL::uuid, 
  p_agent_id uuid DEFAULT NULL::uuid, 
  p_origin text DEFAULT NULL::text, 
  p_date_filter text DEFAULT NULL::text, 
  p_timezone text DEFAULT 'America/Sao_Paulo'::text
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
  v_user_tenant UUID;
BEGIN
  -- CRITICAL: Get user's tenant_id for isolation
  v_user_tenant := get_user_tenant_id();
  IF v_user_tenant IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

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
  
  SELECT jsonb_object_agg(
    COALESCE(channel_id::text, 'no_channel'),
    cnt
  ) INTO result
  FROM (
    SELECT c.channel_id, COUNT(*) as cnt
    FROM conversations c
    WHERE c.tenant_id = v_user_tenant
      AND c.status IN ('open', 'pending')
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
$function$;

-- 3. Fix get_department_counts
CREATE OR REPLACE FUNCTION public.get_department_counts(
  p_agent_id uuid DEFAULT NULL::uuid, 
  p_channel_id uuid DEFAULT NULL::uuid, 
  p_origin text DEFAULT NULL::text, 
  p_date_filter text DEFAULT NULL::text, 
  p_timezone text DEFAULT 'America/Sao_Paulo'::text
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
  v_user_tenant UUID;
BEGIN
  -- CRITICAL: Get user's tenant_id for isolation
  v_user_tenant := get_user_tenant_id();
  IF v_user_tenant IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

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
    WHERE c.tenant_id = v_user_tenant
      AND c.status IN ('open', 'pending')
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
$function$;

-- 4. Fix get_origin_counts
CREATE OR REPLACE FUNCTION public.get_origin_counts(
  p_department_id uuid DEFAULT NULL::uuid, 
  p_agent_id uuid DEFAULT NULL::uuid, 
  p_channel_id uuid DEFAULT NULL::uuid, 
  p_date_filter text DEFAULT NULL::text, 
  p_timezone text DEFAULT 'America/Sao_Paulo'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result JSONB;
  meta_count BIGINT;
  organic_count BIGINT;
  date_start TIMESTAMPTZ;
  date_end TIMESTAMPTZ;
  now_tz TIMESTAMPTZ;
  v_user_tenant UUID;
BEGIN
  -- CRITICAL: Get user's tenant_id for isolation
  v_user_tenant := get_user_tenant_id();
  IF v_user_tenant IS NULL THEN
    RETURN jsonb_build_object('meta_ads', 0, 'organic', 0);
  END IF;

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
  WHERE c.tenant_id = v_user_tenant
    AND c.status IN ('open', 'pending')
    AND (p_department_id IS NULL OR c.department_id = p_department_id)
    AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
    AND (p_channel_id IS NULL OR c.channel_id = p_channel_id)
    AND (date_start IS NULL OR c.created_at >= date_start)
    AND (date_end IS NULL OR c.created_at < date_end);
  
  RETURN jsonb_build_object('meta_ads', COALESCE(meta_count, 0), 'organic', COALESCE(organic_count, 0));
END;
$function$;

-- 5. Fix get_agent_counts
CREATE OR REPLACE FUNCTION public.get_agent_counts(
  p_department_id uuid DEFAULT NULL::uuid, 
  p_channel_id uuid DEFAULT NULL::uuid, 
  p_origin text DEFAULT NULL::text, 
  p_date_filter text DEFAULT NULL::text, 
  p_timezone text DEFAULT 'America/Sao_Paulo'::text
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
  v_user_tenant UUID;
BEGIN
  -- CRITICAL: Get user's tenant_id for isolation
  v_user_tenant := get_user_tenant_id();
  IF v_user_tenant IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

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
    WHERE c.tenant_id = v_user_tenant
      AND c.status IN ('open', 'pending')
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
$function$;

-- 6. Fix get_lead_status_counts
CREATE OR REPLACE FUNCTION public.get_lead_status_counts(
  p_department_id uuid DEFAULT NULL::uuid, 
  p_agent_id uuid DEFAULT NULL::uuid, 
  p_channel_id uuid DEFAULT NULL::uuid, 
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
  v_user_tenant UUID;
BEGIN
  -- CRITICAL: Get user's tenant_id for isolation
  v_user_tenant := get_user_tenant_id();
  IF v_user_tenant IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_object_agg(lead_status, cnt), '{}'::jsonb)
  INTO result
  FROM (
    SELECT 
      c.lead_status,
      COUNT(DISTINCT conv.id) as cnt
    FROM contacts c
    INNER JOIN conversations conv ON conv.contact_id = c.id
    WHERE 
      c.tenant_id = v_user_tenant
      AND conv.tenant_id = v_user_tenant
      AND c.lead_status IS NOT NULL
      AND c.lead_status != ''
      AND (
        p_status_filter = 'all' 
        OR (p_status_filter = 'active' AND conv.status IN ('open', 'pending'))
        OR (p_status_filter = 'open' AND conv.status = 'open')
        OR (p_status_filter = 'pending' AND conv.status = 'pending')
        OR (p_status_filter = 'closed' AND conv.status = 'closed')
      )
      AND (p_department_id IS NULL OR conv.department_id = p_department_id)
      AND (p_agent_id IS NULL OR conv.assigned_to = p_agent_id)
      AND (p_channel_id IS NULL OR conv.channel_id = p_channel_id)
      AND (
        p_origin IS NULL 
        OR (p_origin = 'meta_ads' AND conv.referral_source = 'meta_ads')
        OR (p_origin = 'organic' AND (conv.referral_source IS NULL OR conv.referral_source != 'meta_ads'))
      )
    GROUP BY c.lead_status
  ) counts;
  
  RETURN result;
END;
$function$;

-- 7. Fix get_conversation_tag_counts
CREATE OR REPLACE FUNCTION public.get_conversation_tag_counts(
  p_department_id uuid DEFAULT NULL::uuid, 
  p_agent_id uuid DEFAULT NULL::uuid, 
  p_channel_id uuid DEFAULT NULL::uuid, 
  p_origin text DEFAULT NULL::text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_tenant UUID;
BEGIN
  -- CRITICAL: Get user's tenant_id for isolation
  v_user_tenant := get_user_tenant_id();
  IF v_user_tenant IS NULL THEN
    RETURN '{}'::json;
  END IF;

  RETURN (
    SELECT COALESCE(json_object_agg(tag_id::text, cnt), '{}'::json)
    FROM (
      SELECT ct.tag_id, COUNT(DISTINCT c.id) as cnt
      FROM conversations c
      INNER JOIN contact_tags ct ON ct.contact_id = c.contact_id
      WHERE c.tenant_id = v_user_tenant
        AND ct.tenant_id = v_user_tenant
        AND c.status = 'open'
        AND (p_department_id IS NULL OR c.department_id = p_department_id)
        AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
        AND (p_channel_id IS NULL OR c.channel_id = p_channel_id)
        AND (p_origin IS NULL 
             OR (p_origin = 'meta_ads' AND c.referral_source = 'meta_ads')
             OR (p_origin = 'organic' AND (c.referral_source IS NULL OR c.referral_source != 'meta_ads')))
      GROUP BY ct.tag_id
    ) s
  );
END;
$function$;

-- 8. Fix get_no_tag_conversation_count
CREATE OR REPLACE FUNCTION public.get_no_tag_conversation_count(
  p_department_id uuid DEFAULT NULL::uuid, 
  p_agent_id uuid DEFAULT NULL::uuid, 
  p_channel_id uuid DEFAULT NULL::uuid, 
  p_origin text DEFAULT NULL::text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result BIGINT;
  v_user_tenant UUID;
BEGIN
  -- CRITICAL: Get user's tenant_id for isolation
  v_user_tenant := get_user_tenant_id();
  IF v_user_tenant IS NULL THEN
    RETURN 0;
  END IF;

  SELECT COUNT(DISTINCT c.id) INTO result
  FROM conversations c
  WHERE c.tenant_id = v_user_tenant
    AND c.status IN ('open', 'pending')
    AND NOT EXISTS (
      SELECT 1 FROM contact_tags ct 
      WHERE ct.contact_id = c.contact_id 
      AND ct.tenant_id = v_user_tenant
    )
    AND (p_department_id IS NULL OR c.department_id = p_department_id)
    AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
    AND (p_channel_id IS NULL OR c.channel_id = p_channel_id)
    AND (p_origin IS NULL 
         OR (p_origin = 'meta_ads' AND c.referral_source = 'meta_ads')
         OR (p_origin = 'organic' AND (c.referral_source IS NULL OR c.referral_source != 'meta_ads')));
  
  RETURN COALESCE(result, 0);
END;
$function$;

-- 9. Fix get_shared_conversation_count
CREATE OR REPLACE FUNCTION public.get_shared_conversation_count(p_user_id uuid)
RETURNS TABLE(total bigint, unread bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_tenant UUID;
BEGIN
  -- CRITICAL: Get user's tenant_id for isolation
  v_user_tenant := get_user_tenant_id();
  IF v_user_tenant IS NULL THEN
    RETURN QUERY SELECT 0::BIGINT, 0::BIGINT;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    COUNT(DISTINCT sc.conversation_id)::BIGINT as total,
    COUNT(DISTINCT CASE WHEN c.is_unread = true THEN sc.conversation_id END)::BIGINT as unread
  FROM shared_conversations sc
  INNER JOIN conversations c ON c.id = sc.conversation_id
  WHERE c.tenant_id = v_user_tenant
    AND sc.tenant_id = v_user_tenant
    AND (
      sc.shared_with = p_user_id
      OR sc.department_id IN (SELECT department_id FROM user_departments WHERE user_id = p_user_id)
    )
    AND sc.shared_by != p_user_id
    AND c.status IN ('open', 'pending');
END;
$function$;

-- 10. Fix get_contact_filter_counts
CREATE OR REPLACE FUNCTION public.get_contact_filter_counts()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result JSON;
  v_user_tenant UUID;
BEGIN
  -- CRITICAL: Get user's tenant_id for isolation
  v_user_tenant := get_user_tenant_id();
  IF v_user_tenant IS NULL THEN
    RETURN json_build_object('byState', '{}', 'byStatus', '{}', 'byAssignee', '{}', 'byTag', '{}');
  END IF;

  SELECT json_build_object(
    'byState', COALESCE((
      SELECT json_object_agg(state, cnt)
      FROM (
        SELECT state, COUNT(*) as cnt 
        FROM contacts 
        WHERE tenant_id = v_user_tenant AND state IS NOT NULL 
        GROUP BY state
      ) s
    ), '{}'::json),
    'byStatus', COALESCE((
      SELECT json_object_agg(COALESCE(lead_status, 'sem_status'), cnt)
      FROM (
        SELECT lead_status, COUNT(*) as cnt 
        FROM contacts 
        WHERE tenant_id = v_user_tenant
        GROUP BY lead_status
      ) s
    ), '{}'::json),
    'byAssignee', COALESCE((
      SELECT json_object_agg(assigned_to::text, cnt)
      FROM (
        SELECT assigned_to, COUNT(*) as cnt 
        FROM contacts 
        WHERE tenant_id = v_user_tenant AND assigned_to IS NOT NULL 
        GROUP BY assigned_to
      ) s
    ), '{}'::json),
    'byTag', COALESCE((
      SELECT json_object_agg(tag_id::text, cnt)
      FROM (
        SELECT tag_id, COUNT(DISTINCT contact_id) as cnt 
        FROM contact_tags 
        WHERE tenant_id = v_user_tenant
        GROUP BY tag_id
      ) s
    ), '{}'::json)
  ) INTO result;
  
  RETURN result;
END;
$function$;