CREATE OR REPLACE FUNCTION public.get_agent_waiting_conversations(p_agent_id uuid)
RETURNS TABLE(
  conversation_id uuid,
  contact_id uuid,
  contact_name text,
  contact_phone text,
  contact_avatar text,
  last_message_preview text,
  waiting_since timestamp with time zone,
  waiting_minutes integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id as conversation_id,
    ct.id as contact_id,
    ct.full_name as contact_name,
    ct.phone as contact_phone,
    ct.avatar_url as contact_avatar,
    c.last_message_preview,
    c.last_message_at as waiting_since,
    COALESCE(
      EXTRACT(EPOCH FROM (NOW() - c.last_message_at)) / 60,
      0
    )::INTEGER as waiting_minutes
  FROM conversations c
  INNER JOIN contacts ct ON ct.id = c.contact_id
  WHERE c.assigned_to = p_agent_id
    AND c.status = 'open'
    AND c.last_message_is_from_me = false
  ORDER BY c.last_message_at ASC;
END;
$$;