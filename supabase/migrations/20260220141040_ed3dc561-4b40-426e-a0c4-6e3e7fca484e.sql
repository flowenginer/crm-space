DROP FUNCTION IF EXISTS public.search_conversations_report(timestamp with time zone, timestamp with time zone, text, text, text[], uuid[], text[], text[], uuid[], text[], integer, integer);

CREATE OR REPLACE FUNCTION public.search_conversations_report(
  p_start_date timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_end_date timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_name text DEFAULT NULL::text,
  p_phone text DEFAULT NULL::text,
  p_lead_status text[] DEFAULT NULL::text[],
  p_channel_ids uuid[] DEFAULT NULL::uuid[],
  p_agent_ids text[] DEFAULT NULL::text[],
  p_department_ids text[] DEFAULT NULL::text[],
  p_tag_ids uuid[] DEFAULT NULL::uuid[],
  p_conversation_status text[] DEFAULT NULL::text[],
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50
)
RETURNS TABLE(
  id uuid,
  contact_id uuid,
  channel_id uuid,
  assigned_to uuid,
  department_id uuid,
  status text,
  lead_status text,
  created_at timestamp with time zone,
  closed_at timestamp with time zone,
  close_reason text,
  last_message_at timestamp with time zone,
  contact_full_name text,
  contact_phone text,
  contact_lead_status text,
  contact_origin text,
  referral_source_app text,
  referral_source_url text,
  channel_name text,
  agent_name text,
  department_name text,
  first_message_content text,
  total_count bigint,
  first_response_at timestamp with time zone,
  total_active_time_seconds integer,
  contact_lead_score integer,
  sent_messages_count bigint,
  received_messages_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_offset integer;
  v_total bigint;
  v_has_no_agent boolean;
  v_has_no_department boolean;
  v_real_agent_ids uuid[];
  v_real_department_ids uuid[];
BEGIN
  v_offset := (p_page - 1) * p_page_size;
  
  v_has_no_agent := p_agent_ids IS NOT NULL AND 'no_agent' = ANY(p_agent_ids);
  IF p_agent_ids IS NOT NULL THEN
    SELECT array_agg(val::uuid) INTO v_real_agent_ids
    FROM unnest(p_agent_ids) AS val
    WHERE val != 'no_agent' AND val ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  END IF;
  
  v_has_no_department := p_department_ids IS NOT NULL AND 'no_department' = ANY(p_department_ids);
  IF p_department_ids IS NOT NULL THEN
    SELECT array_agg(val::uuid) INTO v_real_department_ids
    FROM unnest(p_department_ids) AS val
    WHERE val != 'no_department' AND val ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  END IF;
  
  SELECT COUNT(DISTINCT c.id) INTO v_total
  FROM conversations c
  INNER JOIN contacts ct ON ct.id = c.contact_id
  LEFT JOIN whatsapp_channels wc ON wc.id = c.channel_id
  LEFT JOIN profiles p ON p.id = c.assigned_to
  LEFT JOIN departments d ON d.id = c.department_id
  LEFT JOIN conversation_tags cvt ON cvt.conversation_id = c.id
  WHERE
    (p_start_date IS NULL OR c.created_at >= p_start_date)
    AND (p_end_date IS NULL OR c.created_at <= p_end_date)
    AND (p_name IS NULL OR p_name = '' OR ct.full_name ILIKE '%' || p_name || '%')
    AND (p_phone IS NULL OR p_phone = '' OR ct.phone ILIKE '%' || regexp_replace(p_phone, '\D', '', 'g') || '%')
    AND (p_lead_status IS NULL OR array_length(p_lead_status, 1) IS NULL OR ct.lead_status = ANY(p_lead_status))
    AND (p_channel_ids IS NULL OR array_length(p_channel_ids, 1) IS NULL OR c.channel_id = ANY(p_channel_ids))
    AND (
      p_agent_ids IS NULL 
      OR array_length(p_agent_ids, 1) IS NULL
      OR (v_has_no_agent AND c.assigned_to IS NULL)
      OR (v_real_agent_ids IS NOT NULL AND c.assigned_to = ANY(v_real_agent_ids))
    )
    AND (
      p_department_ids IS NULL 
      OR array_length(p_department_ids, 1) IS NULL
      OR (v_has_no_department AND c.department_id IS NULL)
      OR (v_real_department_ids IS NOT NULL AND c.department_id = ANY(v_real_department_ids))
    )
    AND (p_tag_ids IS NULL OR array_length(p_tag_ids, 1) IS NULL OR cvt.tag_id = ANY(p_tag_ids))
    AND (p_conversation_status IS NULL OR array_length(p_conversation_status, 1) IS NULL OR c.status = ANY(p_conversation_status));

  RETURN QUERY
  WITH base_conversations AS (
    SELECT DISTINCT ON (c.id)
      c.id,
      c.contact_id,
      c.channel_id,
      c.assigned_to,
      c.department_id,
      c.status,
      c.lead_status,
      c.created_at,
      c.closed_at,
      c.close_reason,
      c.last_message_at,
      c.first_response_at,
      c.total_active_time_seconds,
      ct.full_name as contact_full_name,
      ct.phone as contact_phone,
      ct.lead_status as contact_lead_status,
      ct.origin as contact_origin,
      ct.lead_score as contact_lead_score,
      COALESCE(
        c.referral_data->>'sourceApp',
        CASE
          WHEN c.referral_data->>'source_url' ILIKE '%instagram.com%' THEN 'instagram'
          WHEN c.referral_data->>'source_url' ILIKE '%facebook.com%' OR c.referral_data->>'source_url' ILIKE '%fb.me%' THEN 'facebook'
          ELSE NULL
        END
      )::text as referral_source_app,
      COALESCE(
        c.referral_data->>'sourceUrl',
        c.referral_data->>'source_url'
      )::text as referral_source_url,
      wc.name as channel_name,
      p.full_name as agent_name,
      d.name as department_name
    FROM conversations c
    INNER JOIN contacts ct ON ct.id = c.contact_id
    LEFT JOIN whatsapp_channels wc ON wc.id = c.channel_id
    LEFT JOIN profiles p ON p.id = c.assigned_to
    LEFT JOIN departments d ON d.id = c.department_id
    LEFT JOIN conversation_tags cvt ON cvt.conversation_id = c.id
    WHERE
      (p_start_date IS NULL OR c.created_at >= p_start_date)
      AND (p_end_date IS NULL OR c.created_at <= p_end_date)
      AND (p_name IS NULL OR p_name = '' OR ct.full_name ILIKE '%' || p_name || '%')
      AND (p_phone IS NULL OR p_phone = '' OR ct.phone ILIKE '%' || regexp_replace(p_phone, '\D', '', 'g') || '%')
      AND (p_lead_status IS NULL OR array_length(p_lead_status, 1) IS NULL OR ct.lead_status = ANY(p_lead_status))
      AND (p_channel_ids IS NULL OR array_length(p_channel_ids, 1) IS NULL OR c.channel_id = ANY(p_channel_ids))
      AND (
        p_agent_ids IS NULL 
        OR array_length(p_agent_ids, 1) IS NULL
        OR (v_has_no_agent AND c.assigned_to IS NULL)
        OR (v_real_agent_ids IS NOT NULL AND c.assigned_to = ANY(v_real_agent_ids))
      )
      AND (
        p_department_ids IS NULL 
        OR array_length(p_department_ids, 1) IS NULL
        OR (v_has_no_department AND c.department_id IS NULL)
        OR (v_real_department_ids IS NOT NULL AND c.department_id = ANY(v_real_department_ids))
      )
      AND (p_tag_ids IS NULL OR array_length(p_tag_ids, 1) IS NULL OR cvt.tag_id = ANY(p_tag_ids))
      AND (p_conversation_status IS NULL OR array_length(p_conversation_status, 1) IS NULL OR c.status = ANY(p_conversation_status))
    ORDER BY c.id, c.created_at DESC
  ),
  msg_counts AS (
    SELECT
      m.conversation_id,
      COUNT(CASE WHEN m.is_from_me = true THEN 1 END)::bigint as sent_count,
      COUNT(CASE WHEN m.is_from_me = false THEN 1 END)::bigint as received_count
    FROM messages m
    INNER JOIN base_conversations bc ON bc.id = m.conversation_id
    GROUP BY m.conversation_id
  ),
  first_messages AS (
    SELECT DISTINCT ON (m.conversation_id)
      m.conversation_id,
      m.content as first_message_content
    FROM messages m
    INNER JOIN base_conversations bc ON bc.id = m.conversation_id
    WHERE m.is_from_me = false AND m.content IS NOT NULL AND m.content != ''
    ORDER BY m.conversation_id, m.created_at ASC
  )
  SELECT
    bc.id,
    bc.contact_id,
    bc.channel_id,
    bc.assigned_to,
    bc.department_id,
    bc.status,
    bc.lead_status,
    bc.created_at,
    bc.closed_at,
    bc.close_reason,
    bc.last_message_at,
    bc.contact_full_name,
    bc.contact_phone,
    bc.contact_lead_status,
    bc.contact_origin,
    bc.referral_source_app,
    bc.referral_source_url,
    bc.channel_name,
    bc.agent_name,
    bc.department_name,
    fm.first_message_content,
    v_total,
    bc.first_response_at,
    bc.total_active_time_seconds,
    bc.contact_lead_score,
    COALESCE(mc.sent_count, 0)::bigint,
    COALESCE(mc.received_count, 0)::bigint
  FROM base_conversations bc
  LEFT JOIN first_messages fm ON fm.conversation_id = bc.id
  LEFT JOIN msg_counts mc ON mc.conversation_id = bc.id
  ORDER BY bc.created_at DESC
  LIMIT p_page_size OFFSET v_offset;
END;
$function$;