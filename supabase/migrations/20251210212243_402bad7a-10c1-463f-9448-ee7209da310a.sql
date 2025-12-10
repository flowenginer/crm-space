-- Função RPC para buscar histórico de transferências com filtros
CREATE OR REPLACE FUNCTION get_transfer_history(
  p_date_from TIMESTAMPTZ,
  p_date_to TIMESTAMPTZ,
  p_from_user_id UUID DEFAULT NULL,
  p_to_user_id UUID DEFAULT NULL,
  p_from_department_id UUID DEFAULT NULL,
  p_to_department_id UUID DEFAULT NULL,
  p_transfer_type TEXT DEFAULT 'all', -- 'all', 'transfer', 'return'
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  conversation_id UUID,
  contact_id UUID,
  contact_name TEXT,
  contact_phone TEXT,
  transferred_at TIMESTAMPTZ,
  from_user_id UUID,
  from_user_name TEXT,
  to_user_id UUID,
  to_user_name TEXT,
  from_department_id UUID,
  from_department_name TEXT,
  to_department_id UUID,
  to_department_name TEXT,
  transfer_note TEXT,
  is_return BOOLEAN,
  actor_id UUID,
  actor_name TEXT,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total BIGINT;
BEGIN
  -- Primeiro conta o total para paginação
  SELECT COUNT(*) INTO v_total
  FROM conversation_events ce
  WHERE ce.event_type = 'transfer'
    AND ce.created_at >= p_date_from
    AND ce.created_at <= p_date_to
    AND (p_from_user_id IS NULL OR (ce.data->>'from_user_id')::uuid = p_from_user_id)
    AND (p_to_user_id IS NULL OR (ce.data->>'to_user_id')::uuid = p_to_user_id)
    AND (p_from_department_id IS NULL OR (ce.data->>'from_department_id')::uuid = p_from_department_id)
    AND (p_to_department_id IS NULL OR (ce.data->>'to_department_id')::uuid = p_to_department_id)
    AND (
      p_transfer_type = 'all' 
      OR (p_transfer_type = 'return' AND (ce.data->>'is_return')::boolean = true)
      OR (p_transfer_type = 'transfer' AND COALESCE((ce.data->>'is_return')::boolean, false) = false)
    );

  RETURN QUERY
  SELECT 
    ce.id,
    ce.conversation_id,
    c.id AS contact_id,
    c.full_name AS contact_name,
    c.phone AS contact_phone,
    ce.created_at AS transferred_at,
    (ce.data->>'from_user_id')::uuid AS from_user_id,
    pf.full_name AS from_user_name,
    (ce.data->>'to_user_id')::uuid AS to_user_id,
    pt.full_name AS to_user_name,
    (ce.data->>'from_department_id')::uuid AS from_department_id,
    df.name AS from_department_name,
    (ce.data->>'to_department_id')::uuid AS to_department_id,
    dt.name AS to_department_name,
    ce.data->>'note' AS transfer_note,
    COALESCE((ce.data->>'is_return')::boolean, false) AS is_return,
    ce.actor_id,
    pa.full_name AS actor_name,
    v_total AS total_count
  FROM conversation_events ce
  JOIN conversations conv ON conv.id = ce.conversation_id
  JOIN contacts c ON c.id = conv.contact_id
  LEFT JOIN profiles pf ON pf.id = (ce.data->>'from_user_id')::uuid
  LEFT JOIN profiles pt ON pt.id = (ce.data->>'to_user_id')::uuid
  LEFT JOIN profiles pa ON pa.id = ce.actor_id
  LEFT JOIN departments df ON df.id = (ce.data->>'from_department_id')::uuid
  LEFT JOIN departments dt ON dt.id = (ce.data->>'to_department_id')::uuid
  WHERE ce.event_type = 'transfer'
    AND ce.created_at >= p_date_from
    AND ce.created_at <= p_date_to
    AND (p_from_user_id IS NULL OR (ce.data->>'from_user_id')::uuid = p_from_user_id)
    AND (p_to_user_id IS NULL OR (ce.data->>'to_user_id')::uuid = p_to_user_id)
    AND (p_from_department_id IS NULL OR (ce.data->>'from_department_id')::uuid = p_from_department_id)
    AND (p_to_department_id IS NULL OR (ce.data->>'to_department_id')::uuid = p_to_department_id)
    AND (
      p_transfer_type = 'all' 
      OR (p_transfer_type = 'return' AND (ce.data->>'is_return')::boolean = true)
      OR (p_transfer_type = 'transfer' AND COALESCE((ce.data->>'is_return')::boolean, false) = false)
    )
  ORDER BY ce.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;