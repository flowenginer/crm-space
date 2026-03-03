
-- Drop and recreate search_conversations_report with internal_notes_text field
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
RETURNS TABLE(
  id text,
  contact_id text,
  channel_id text,
  assigned_to text,
  department_id text,
  status text,
  lead_status text,
  created_at text,
  closed_at text,
  close_reason text,
  last_message_at text,
  first_response_at text,
  total_active_time_seconds integer,
  sent_messages_count bigint,
  received_messages_count bigint,
  contact_full_name text,
  contact_phone text,
  contact_lead_status text,
  contact_origin text,
  contact_lead_score integer,
  channel_name text,
  agent_name text,
  department_name text,
  first_message_content text,
  referral_source_app text,
  referral_source_url text,
  internal_notes_text text,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id text;
  v_offset integer;
BEGIN
  -- Get tenant_id from current user
  SELECT p.tenant_id INTO v_tenant_id
  FROM profiles p
  WHERE p.id = auth.uid()
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RETURN;
  END IF;

  v_offset := (p_page - 1) * p_page_size;

  RETURN QUERY
  WITH base_conversations AS (
    SELECT
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
      c.referral_data,
      co.full_name AS contact_full_name,
      co.phone AS contact_phone,
      co.lead_status AS contact_lead_status,
      co.origin AS contact_origin,
      co.lead_score AS contact_lead_score,
      wc.name AS channel_name,
      pr.full_name AS agent_name,
      dp.name AS department_name
    FROM conversations c
    JOIN contacts co ON co.id = c.contact_id
    LEFT JOIN whatsapp_channels wc ON wc.id = c.channel_id
    LEFT JOIN profiles pr ON pr.id = c.assigned_to
    LEFT JOIN departments dp ON dp.id = c.department_id
    WHERE c.tenant_id = v_tenant_id
      AND (p_start_date IS NULL OR c.created_at >= p_start_date::timestamptz)
      AND (p_end_date IS NULL OR c.created_at <= p_end_date::timestamptz)
      AND (p_name IS NULL OR co.full_name ILIKE '%' || p_name || '%')
      AND (p_phone IS NULL OR co.phone ILIKE '%' || p_phone || '%')
      AND (p_lead_status IS NULL OR co.lead_status = ANY(p_lead_status))
      AND (p_channel_ids IS NULL OR c.channel_id = ANY(p_channel_ids))
      AND (p_agent_ids IS NULL OR c.assigned_to = ANY(p_agent_ids))
      AND (p_department_ids IS NULL OR c.department_id = ANY(p_department_ids))
      AND (p_conversation_status IS NULL OR c.status = ANY(p_conversation_status))
      AND (
        p_tag_ids IS NULL OR EXISTS (
          SELECT 1 FROM conversation_tags ct
          WHERE ct.conversation_id = c.id AND ct.tag_id = ANY(p_tag_ids)
        )
      )
  ),
  message_stats AS (
    SELECT
      m.conversation_id,
      COUNT(*) FILTER (WHERE m.is_from_me = true) AS sent_count,
      COUNT(*) FILTER (WHERE m.is_from_me = false) AS received_count,
      MIN(m.content) FILTER (WHERE m.is_from_me = false AND m.content IS NOT NULL AND m.content != '') AS first_message_content
    FROM messages m
    WHERE m.conversation_id IN (SELECT bc.id FROM base_conversations bc)
    GROUP BY m.conversation_id
  ),
  referral_data_extracted AS (
    SELECT
      bc.id AS conversation_id,
      COALESCE(
        (bc.referral_data->>'source_type'),
        (bc.referral_data->>'source'),
        ''
      ) AS referral_source_app,
      COALESCE(
        (bc.referral_data->>'source_url'),
        (bc.referral_data->>'url'),
        ''
      ) AS referral_source_url
    FROM base_conversations bc
  ),
  internal_notes_agg AS (
    SELECT
      n.conversation_id,
      STRING_AGG(n.content, ' | ' ORDER BY n.created_at ASC) AS notes_text
    FROM internal_notes n
    WHERE n.conversation_id IN (SELECT bc.id FROM base_conversations bc)
    GROUP BY n.conversation_id
  ),
  total AS (
    SELECT COUNT(*) AS cnt FROM base_conversations
  )
  SELECT
    bc.id::text,
    bc.contact_id::text,
    bc.channel_id::text,
    bc.assigned_to::text,
    bc.department_id::text,
    bc.status::text,
    bc.lead_status::text,
    bc.created_at::text,
    bc.closed_at::text,
    bc.close_reason::text,
    bc.last_message_at::text,
    bc.first_response_at::text,
    bc.total_active_time_seconds::integer,
    COALESCE(ms.sent_count, 0)::bigint,
    COALESCE(ms.received_count, 0)::bigint,
    bc.contact_full_name::text,
    bc.contact_phone::text,
    bc.contact_lead_status::text,
    bc.contact_origin::text,
    bc.contact_lead_score::integer,
    bc.channel_name::text,
    bc.agent_name::text,
    bc.department_name::text,
    ms.first_message_content::text,
    COALESCE(rde.referral_source_app, '')::text,
    COALESCE(rde.referral_source_url, '')::text,
    COALESCE(ina.notes_text, '')::text AS internal_notes_text,
    t.cnt::bigint
  FROM base_conversations bc
  LEFT JOIN message_stats ms ON ms.conversation_id = bc.id
  LEFT JOIN referral_data_extracted rde ON rde.conversation_id = bc.id
  LEFT JOIN internal_notes_agg ina ON ina.conversation_id = bc.id
  CROSS JOIN total t
  ORDER BY bc.created_at DESC
  LIMIT p_page_size OFFSET v_offset;
END;
$$;
