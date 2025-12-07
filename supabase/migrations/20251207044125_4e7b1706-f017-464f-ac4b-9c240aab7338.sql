-- Create function to search conversations for report with server-side filtering
CREATE OR REPLACE FUNCTION public.search_conversations_report(
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL,
  p_name text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_lead_status text[] DEFAULT NULL,
  p_channel_ids uuid[] DEFAULT NULL,
  p_agent_ids uuid[] DEFAULT NULL,
  p_department_ids uuid[] DEFAULT NULL,
  p_tag_ids uuid[] DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  contact_id uuid,
  channel_id uuid,
  assigned_to uuid,
  department_id uuid,
  status text,
  lead_status text,
  created_at timestamptz,
  closed_at timestamptz,
  close_reason text,
  last_message_at timestamptz,
  contact_full_name text,
  contact_phone text,
  contact_lead_status text,
  channel_name text,
  agent_name text,
  department_name text,
  first_message_content text,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offset integer;
  v_total bigint;
BEGIN
  v_offset := (p_page - 1) * p_page_size;
  
  -- Get total count first
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
    AND (p_agent_ids IS NULL OR array_length(p_agent_ids, 1) IS NULL OR c.assigned_to = ANY(p_agent_ids))
    AND (p_department_ids IS NULL OR array_length(p_department_ids, 1) IS NULL OR c.department_id = ANY(p_department_ids))
    AND (p_tag_ids IS NULL OR array_length(p_tag_ids, 1) IS NULL OR cvt.tag_id = ANY(p_tag_ids));

  -- Return paginated results with total count
  RETURN QUERY
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
    ct.full_name as contact_full_name,
    ct.phone as contact_phone,
    ct.lead_status as contact_lead_status,
    wc.name as channel_name,
    p.full_name as agent_name,
    d.name as department_name,
    (
      SELECT m.content 
      FROM messages m 
      WHERE m.conversation_id = c.id 
      ORDER BY m.created_at ASC 
      LIMIT 1
    ) as first_message_content,
    v_total as total_count
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
    AND (p_agent_ids IS NULL OR array_length(p_agent_ids, 1) IS NULL OR c.assigned_to = ANY(p_agent_ids))
    AND (p_department_ids IS NULL OR array_length(p_department_ids, 1) IS NULL OR c.department_id = ANY(p_department_ids))
    AND (p_tag_ids IS NULL OR array_length(p_tag_ids, 1) IS NULL OR cvt.tag_id = ANY(p_tag_ids))
  ORDER BY c.id, c.created_at DESC
  LIMIT p_page_size
  OFFSET v_offset;
END;
$$;