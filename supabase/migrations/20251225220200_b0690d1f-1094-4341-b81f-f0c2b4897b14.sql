-- Função RPC para agregar mensagens por hora diretamente no banco
-- Evita o limite de 1000 registros do Supabase client
CREATE OR REPLACE FUNCTION get_interaction_timeline(
  p_date_from TIMESTAMPTZ,
  p_date_to TIMESTAMPTZ,
  p_agent_id UUID DEFAULT NULL,
  p_department_id UUID DEFAULT NULL
)
RETURNS TABLE (
  hour_slot INT,
  hour_label TEXT,
  client_messages BIGINT,
  agent_messages BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID := get_user_tenant_id();
BEGIN
  RETURN QUERY
  WITH filtered_messages AS (
    SELECT 
      m.id,
      m.is_from_me,
      m.created_at,
      EXTRACT(HOUR FROM m.created_at AT TIME ZONE 'America/Sao_Paulo')::INT AS hora,
      CASE WHEN EXTRACT(MINUTE FROM m.created_at AT TIME ZONE 'America/Sao_Paulo') >= 30 THEN 1 ELSE 0 END AS half_hour
    FROM messages m
    INNER JOIN conversations c ON c.id = m.conversation_id
    WHERE m.tenant_id = v_tenant_id
      AND m.created_at >= p_date_from
      AND m.created_at <= p_date_to
      AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
      AND (p_department_id IS NULL OR c.department_id = p_department_id)
  )
  SELECT 
    (fm.hora * 2 + fm.half_hour)::INT AS hour_slot,
    LPAD(fm.hora::TEXT, 2, '0') || CASE WHEN fm.half_hour = 0 THEN ':00' ELSE ':30' END AS hour_label,
    COUNT(*) FILTER (WHERE NOT fm.is_from_me) AS client_messages,
    COUNT(*) FILTER (WHERE fm.is_from_me) AS agent_messages
  FROM filtered_messages fm
  GROUP BY fm.hora, fm.half_hour
  ORDER BY fm.hora, fm.half_hour;
END;
$$;