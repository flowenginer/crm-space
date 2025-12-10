-- Adicionar campo de configuração de alerta de tempo de resposta
ALTER TABLE company_settings 
ADD COLUMN IF NOT EXISTS response_alert_minutes INTEGER DEFAULT 5;

-- Criar função RPC para buscar status de resposta dos agentes em tempo real
CREATE OR REPLACE FUNCTION get_agents_response_status()
RETURNS TABLE(
  agent_id UUID,
  agent_name TEXT,
  avatar_url TEXT,
  is_available BOOLEAN,
  is_online BOOLEAN,
  department_name TEXT,
  open_conversations BIGINT,
  waiting_response BIGINT,
  oldest_waiting_minutes INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as agent_id,
    p.full_name as agent_name,
    p.avatar_url,
    COALESCE(p.is_available, true) as is_available,
    COALESCE(p.is_online, false) as is_online,
    d.name as department_name,
    COUNT(DISTINCT c.id)::BIGINT as open_conversations,
    COUNT(DISTINCT CASE 
      WHEN c.is_unread = true AND c.last_message_is_from_me = false 
      THEN c.id 
    END)::BIGINT as waiting_response,
    COALESCE(
      MAX(
        CASE 
          WHEN c.is_unread = true AND c.last_message_is_from_me = false AND c.last_message_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (NOW() - c.last_message_at)) / 60
        END
      )::INTEGER, 
      0
    ) as oldest_waiting_minutes
  FROM profiles p
  LEFT JOIN departments d ON d.id = p.department_id
  LEFT JOIN conversations c ON c.assigned_to = p.id AND c.status IN ('open', 'pending')
  WHERE p.is_active = true
    AND p.role IN ('user', 'supervisor', 'admin')
  GROUP BY p.id, p.full_name, p.avatar_url, p.is_available, p.is_online, d.name
  ORDER BY 
    COALESCE(
      MAX(
        CASE 
          WHEN c.is_unread = true AND c.last_message_is_from_me = false AND c.last_message_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (NOW() - c.last_message_at)) / 60
        END
      ), 
      0
    ) DESC,
    p.full_name;
END;
$$;

-- Criar função RPC para buscar histórico de tempo médio de resposta
CREATE OR REPLACE FUNCTION get_agents_response_history(p_days INTEGER DEFAULT 7)
RETURNS TABLE(
  agent_id UUID,
  agent_name TEXT,
  report_date DATE,
  total_conversations BIGINT,
  avg_response_minutes NUMERIC
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH first_messages AS (
    SELECT 
      c.id as conversation_id,
      c.assigned_to,
      c.created_at::DATE as conv_date,
      MIN(CASE WHEN m.is_from_me = false THEN m.created_at END) as first_client_msg,
      MIN(CASE WHEN m.is_from_me = true THEN m.created_at END) as first_agent_msg
    FROM conversations c
    INNER JOIN messages m ON m.conversation_id = c.id
    WHERE c.assigned_to IS NOT NULL
      AND c.created_at >= NOW() - (p_days || ' days')::INTERVAL
    GROUP BY c.id, c.assigned_to, c.created_at::DATE
  ),
  response_times AS (
    SELECT
      fm.assigned_to,
      fm.conv_date,
      CASE 
        WHEN fm.first_agent_msg > fm.first_client_msg 
        THEN EXTRACT(EPOCH FROM (fm.first_agent_msg - fm.first_client_msg)) / 60
        ELSE NULL
      END as response_minutes
    FROM first_messages fm
    WHERE fm.first_client_msg IS NOT NULL
  )
  SELECT 
    p.id as agent_id,
    p.full_name as agent_name,
    rt.conv_date as report_date,
    COUNT(*)::BIGINT as total_conversations,
    ROUND(AVG(rt.response_minutes)::NUMERIC, 1) as avg_response_minutes
  FROM response_times rt
  INNER JOIN profiles p ON p.id = rt.assigned_to
  WHERE p.is_active = true
  GROUP BY p.id, p.full_name, rt.conv_date
  ORDER BY rt.conv_date DESC, p.full_name;
END;
$$;