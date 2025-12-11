-- Corrigir função para mostrar todos os usuários ativos, não apenas roles específicos
CREATE OR REPLACE FUNCTION public.get_agents_response_status()
 RETURNS TABLE(agent_id uuid, agent_name text, avatar_url text, is_available boolean, is_online boolean, department_name text, open_conversations bigint, waiting_response bigint, oldest_waiting_minutes double precision, unavailable_until timestamp with time zone, unavailability_reason text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH agent_stats AS (
    SELECT 
      c.assigned_to,
      COUNT(*) FILTER (WHERE c.status = 'open') as open_count,
      COUNT(*) FILTER (
        WHERE c.status = 'open' 
        AND c.last_message_is_from_me = false
      ) as waiting_count,
      MAX(
        CASE 
          WHEN c.status = 'open' AND c.last_message_is_from_me = false 
          THEN EXTRACT(EPOCH FROM (NOW() - c.last_message_at)) / 60 
          ELSE 0 
        END
      )::double precision as oldest_minutes
    FROM conversations c
    WHERE c.assigned_to IS NOT NULL
    GROUP BY c.assigned_to
  )
  SELECT 
    p.id as agent_id,
    p.full_name as agent_name,
    p.avatar_url,
    COALESCE(p.is_available, true) as is_available,
    COALESCE(p.is_online, false) as is_online,
    d.name as department_name,
    COALESCE(s.open_count, 0) as open_conversations,
    COALESCE(s.waiting_count, 0) as waiting_response,
    COALESCE(s.oldest_minutes, 0::double precision) as oldest_waiting_minutes,
    p.unavailable_until,
    p.unavailability_reason
  FROM profiles p
  LEFT JOIN departments d ON d.id = p.department_id
  LEFT JOIN agent_stats s ON s.assigned_to = p.id
  WHERE p.is_active = true
  ORDER BY 
    CASE WHEN COALESCE(s.waiting_count, 0) > 0 THEN 0 ELSE 1 END,
    COALESCE(s.oldest_minutes, 0) DESC,
    p.full_name;
END;
$function$;