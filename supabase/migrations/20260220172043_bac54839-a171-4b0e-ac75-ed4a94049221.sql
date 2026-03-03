
DROP FUNCTION IF EXISTS public.search_conversations_report(text, text, text, text, text[], text[], text[], text[], text[], text[], integer, integer);

CREATE OR REPLACE FUNCTION public.search_conversations_report(
  p_start_date text DEFAULT NULL,
  p_end_date text DEFAULT NULL,
  p_name text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_lead_status text[] DEFAULT NULL,
  p_channel_ids text[] DEFAULT NULL,
  p_agent_ids text[] DEFAULT NULL,
  p_department_ids text[] DEFAULT NULL,
  p_tag_ids text[] DEFAULT NULL,
  p_conversation_status text[] DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  protocol_number text,
  status text,
  lead_status text,
  close_reason text,
  created_at timestamptz,
  closed_at timestamptz,
  first_response_at timestamptz,
  total_active_time_seconds integer,
  contact_id uuid,
  contact_full_name text,
  contact_phone text,
  contact_origin text,
  contact_lead_status text,
  contact_lead_score integer,
  channel_id uuid,
  channel_name text,
  agent_id uuid,
  agent_name text,
  department_id uuid,
  department_name text,
  referral_source_app text,
  referral_source_url text,
  tags text,
  tag_ids text,
  first_message text,
  sent_messages_count bigint,
  received_messages_count bigint,
  internal_notes_text text,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_start_date timestamptz;
  v_end_date timestamptz;
  v_offset integer;
BEGIN
  SELECT profiles.tenant_id INTO v_tenant_id
  FROM profiles
  WHERE profiles.id = auth.uid();

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id é obrigatório e não foi possível determinar automaticamente';
  END IF;

  IF p_start_date IS NOT NULL THEN
    v_start_date := p_start_date::timestamptz;
  END IF;
  IF p_end_date IS NOT NULL THEN
    v_end_date := p_end_date::timestamptz;
  END IF;

  v_offset := (p_page - 1) * p_page_size;

  RETURN QUERY
  WITH filtered_conversations AS (
    SELECT
      c.id,
      c.status,
      c.lead_status,
      c.close_reason,
      c.created_at,
      c.closed_at,
      c.first_response_at,
      c.total_active_time_seconds,
      c.contact_id,
      c.channel_id,
      c.assigned_to,
      c.department_id,
      c.referral_data,
      c.referral_source,
      ROW_NUMBER() OVER (ORDER BY c.created_at DESC) AS rn,
      COUNT(*) OVER () AS total_count
    FROM conversations c
    LEFT JOIN contacts co_filter ON co_filter.id = c.contact_id
    WHERE c.tenant_id = v_tenant_id
      AND (v_start_date IS NULL OR c.created_at >= v_start_date)
      AND (v_end_date IS NULL OR c.created_at <= v_end_date)
      AND (p_name IS NULL OR co_filter.full_name ILIKE '%' || p_name || '%')
      AND (p_phone IS NULL OR c.contact_id IN (
        SELECT co2.id FROM contacts co2 WHERE co2.phone ILIKE '%' || p_phone || '%' AND co2.tenant_id = v_tenant_id
      ))
      AND (p_conversation_status IS NULL OR c.status = ANY(p_conversation_status))
      AND (p_channel_ids IS NULL OR c.channel_id::text = ANY(p_channel_ids))
      AND (p_agent_ids IS NULL OR c.assigned_to::text = ANY(p_agent_ids))
      AND (p_department_ids IS NULL OR c.department_id::text = ANY(p_department_ids))
      AND (
        p_tag_ids IS NULL OR EXISTS (
          SELECT 1 FROM conversation_tags ct
          WHERE ct.conversation_id = c.id
            AND ct.tag_id::text = ANY(p_tag_ids)
        )
      )
  ),
  paged AS (
    SELECT * FROM filtered_conversations
    WHERE rn > v_offset AND rn <= (v_offset + p_page_size)
  )
  SELECT
    p.id,
    (
      SELECT ce.data->>'protocol_number'
      FROM conversation_events ce
      WHERE ce.conversation_id = p.id
        AND ce.event_type = 'protocol_assigned'
      ORDER BY ce.created_at DESC
      LIMIT 1
    ) AS protocol_number,
    p.status,
    p.lead_status,
    p.close_reason,
    p.created_at,
    p.closed_at,
    p.first_response_at,
    p.total_active_time_seconds,
    p.contact_id,
    co.full_name AS contact_full_name,
    co.phone AS contact_phone,
    co.origin AS contact_origin,
    co.lead_status AS contact_lead_status,
    co.lead_score AS contact_lead_score,
    p.channel_id,
    wc.name AS channel_name,
    p.assigned_to AS agent_id,
    pr.full_name AS agent_name,
    p.department_id,
    dp.name AS department_name,
    COALESCE(
      p.referral_data->>'source',
      p.referral_source
    ) AS referral_source_app,
    COALESCE(
      p.referral_data->>'video_url',
      p.referral_data->>'source_url'
    ) AS referral_source_url,
    (
      SELECT STRING_AGG(t.name, ', ' ORDER BY t.name)
      FROM conversation_tags ct
      JOIN tags t ON t.id = ct.tag_id
      WHERE ct.conversation_id = p.id
    ) AS tags,
    (
      SELECT STRING_AGG(ct.tag_id::text, ', ')
      FROM conversation_tags ct
      WHERE ct.conversation_id = p.id
    ) AS tag_ids,
    (
      SELECT m.content
      FROM messages m
      WHERE m.conversation_id = p.id
        AND m.is_from_me = false
      ORDER BY m.created_at ASC
      LIMIT 1
    ) AS first_message,
    (
      SELECT COUNT(*)
      FROM messages m
      WHERE m.conversation_id = p.id
        AND m.is_from_me = true
    ) AS sent_messages_count,
    (
      SELECT COUNT(*)
      FROM messages m
      WHERE m.conversation_id = p.id
        AND m.is_from_me = false
    ) AS received_messages_count,
    (
      SELECT STRING_AGG(m.content, ' | ' ORDER BY m.created_at)
      FROM messages m
      WHERE m.conversation_id = p.id
        AND m.message_type = 'internal_note'
    ) AS internal_notes_text,
    p.total_count
  FROM paged p
  JOIN contacts co ON co.id = p.contact_id
  LEFT JOIN whatsapp_channels wc ON wc.id = p.channel_id
  LEFT JOIN profiles pr ON pr.id = p.assigned_to
  LEFT JOIN departments dp ON dp.id = p.department_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_conversations_report(text, text, text, text, text[], text[], text[], text[], text[], text[], integer, integer) TO authenticated;

NOTIFY pgrst, 'reload schema';
