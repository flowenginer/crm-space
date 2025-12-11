-- Primeiro dropar a função existente para alterar o retorno
DROP FUNCTION IF EXISTS public.get_agents_response_status();

-- Adicionar campos para timer de indisponibilidade na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS unavailable_until TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS unavailability_reason TEXT;

-- Recriar a função com os novos campos de retorno
CREATE OR REPLACE FUNCTION public.get_agents_response_status()
RETURNS TABLE (
  agent_id uuid,
  agent_name text,
  avatar_url text,
  is_available boolean,
  is_online boolean,
  department_name text,
  open_conversations bigint,
  waiting_response bigint,
  oldest_waiting_minutes double precision,
  unavailable_until timestamptz,
  unavailability_reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
      ) as oldest_minutes
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
    COALESCE(s.oldest_minutes, 0) as oldest_waiting_minutes,
    p.unavailable_until,
    p.unavailability_reason
  FROM profiles p
  LEFT JOIN departments d ON d.id = p.department_id
  LEFT JOIN agent_stats s ON s.assigned_to = p.id
  WHERE p.role IN ('agent', 'supervisor', 'admin')
    AND p.is_active = true
  ORDER BY 
    CASE WHEN COALESCE(s.waiting_count, 0) > 0 THEN 0 ELSE 1 END,
    COALESCE(s.oldest_minutes, 0) DESC,
    p.full_name;
END;
$$;