
CREATE OR REPLACE FUNCTION public.get_agents_response_status()
RETURNS TABLE(
  agent_id uuid,
  agent_name text,
  avatar_url text,
  is_available boolean,
  is_online boolean,
  department_name text,
  open_conversations bigint,
  waiting_response bigint,
  oldest_waiting_minutes integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as agent_id,
    p.full_name as agent_name,
    p.avatar_url,
    COALESCE(p.is_available, false) as is_available,
    COALESCE(p.is_online, false) as is_online,
    d.name as department_name,
    COUNT(DISTINCT c.id) FILTER (WHERE c.status IN ('open', 'pending'))::BIGINT as open_conversations,
    COUNT(DISTINCT c.id) FILTER (
      WHERE c.status IN ('open', 'pending') 
      AND c.is_unread = true
      AND c.last_message_is_from_me = false
    )::BIGINT as waiting_response,
    COALESCE(
      EXTRACT(EPOCH FROM (NOW() - MIN(
        CASE WHEN c.status IN ('open', 'pending') 
             AND c.is_unread = true 
             AND c.last_message_is_from_me = false 
        THEN c.last_message_at END
      ))) / 60,
      0
    )::INTEGER as oldest_waiting_minutes
  FROM profiles p
  LEFT JOIN departments d ON d.id = p.department_id
  LEFT JOIN conversations c ON c.assigned_to = p.id
  WHERE p.is_active = true
    AND p.role IN ('vendedor', 'sac', 'supervisor', 'user')
  GROUP BY p.id, p.full_name, p.avatar_url, p.is_available, p.is_online, d.name
  ORDER BY waiting_response DESC, open_conversations DESC, p.full_name;
END;
$$;
