-- Drop the existing function first to change return type
DROP FUNCTION IF EXISTS get_transfer_history(TIMESTAMPTZ, TIMESTAMPTZ, UUID, UUID, UUID, UUID, TEXT, TEXT, INT, INT);

-- Recreate the function with is_share column included
CREATE OR REPLACE FUNCTION get_transfer_history(
  p_date_from TIMESTAMPTZ,
  p_date_to TIMESTAMPTZ,
  p_from_user_id UUID DEFAULT NULL,
  p_to_user_id UUID DEFAULT NULL,
  p_from_department_id UUID DEFAULT NULL,
  p_to_department_id UUID DEFAULT NULL,
  p_transfer_type TEXT DEFAULT 'all',
  p_search_query TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
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
  is_share BOOLEAN,
  actor_id UUID,
  actor_name TEXT,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_count BIGINT;
BEGIN
  -- Get total count first
  SELECT COUNT(*) INTO v_total_count
  FROM conversation_events ce
  JOIN conversations c ON ce.conversation_id = c.id
  JOIN contacts ct ON c.contact_id = ct.id
  WHERE ce.event_type IN ('transfer', 'return', 'share')
    AND ce.created_at BETWEEN p_date_from AND p_date_to
    AND (
      p_transfer_type = 'all' 
      OR (p_transfer_type = 'transfer' AND ce.event_type = 'transfer')
      OR (p_transfer_type = 'return' AND ce.event_type = 'return')
      OR (p_transfer_type = 'share' AND ce.event_type = 'share')
    )
    AND (
      p_from_user_id IS NULL 
      OR (ce.data->>'from_user_id')::UUID = p_from_user_id
      OR (ce.event_type = 'share' AND ce.actor_id = p_from_user_id)
    )
    AND (
      p_to_user_id IS NULL 
      OR (ce.data->>'to_user_id')::UUID = p_to_user_id
      OR (ce.data->>'shared_with_user_id')::UUID = p_to_user_id
    )
    AND (
      p_from_department_id IS NULL 
      OR (ce.data->>'from_department_id')::UUID = p_from_department_id
    )
    AND (
      p_to_department_id IS NULL 
      OR (ce.data->>'to_department_id')::UUID = p_to_department_id
      OR (ce.data->>'shared_with_department_id')::UUID = p_to_department_id
    )
    AND (
      p_search_query IS NULL 
      OR ct.full_name ILIKE '%' || p_search_query || '%'
      OR ct.phone ILIKE '%' || p_search_query || '%'
    );

  -- Return results with total count
  RETURN QUERY
  SELECT 
    ce.id,
    ce.conversation_id,
    c.contact_id,
    ct.full_name AS contact_name,
    ct.phone AS contact_phone,
    ce.created_at AS transferred_at,
    CASE 
      WHEN ce.event_type = 'share' THEN ce.actor_id
      ELSE (ce.data->>'from_user_id')::UUID
    END AS from_user_id,
    CASE 
      WHEN ce.event_type = 'share' THEN (SELECT full_name FROM profiles WHERE profiles.id = ce.actor_id)
      ELSE (SELECT full_name FROM profiles WHERE profiles.id = (ce.data->>'from_user_id')::UUID)
    END AS from_user_name,
    CASE 
      WHEN ce.event_type = 'share' THEN (ce.data->>'shared_with_user_id')::UUID
      ELSE (ce.data->>'to_user_id')::UUID
    END AS to_user_id,
    CASE 
      WHEN ce.event_type = 'share' THEN (SELECT full_name FROM profiles WHERE profiles.id = (ce.data->>'shared_with_user_id')::UUID)
      ELSE (SELECT full_name FROM profiles WHERE profiles.id = (ce.data->>'to_user_id')::UUID)
    END AS to_user_name,
    (ce.data->>'from_department_id')::UUID AS from_department_id,
    (SELECT name FROM departments WHERE departments.id = (ce.data->>'from_department_id')::UUID) AS from_department_name,
    CASE 
      WHEN ce.event_type = 'share' THEN (ce.data->>'shared_with_department_id')::UUID
      ELSE (ce.data->>'to_department_id')::UUID
    END AS to_department_id,
    CASE 
      WHEN ce.event_type = 'share' THEN (SELECT name FROM departments WHERE departments.id = (ce.data->>'shared_with_department_id')::UUID)
      ELSE (SELECT name FROM departments WHERE departments.id = (ce.data->>'to_department_id')::UUID)
    END AS to_department_name,
    COALESCE(ce.data->>'note', ce.data->>'transfer_note') AS transfer_note,
    ce.event_type = 'return' AS is_return,
    ce.event_type = 'share' AS is_share,
    ce.actor_id,
    (SELECT full_name FROM profiles WHERE profiles.id = ce.actor_id) AS actor_name,
    v_total_count AS total_count
  FROM conversation_events ce
  JOIN conversations c ON ce.conversation_id = c.id
  JOIN contacts ct ON c.contact_id = ct.id
  WHERE ce.event_type IN ('transfer', 'return', 'share')
    AND ce.created_at BETWEEN p_date_from AND p_date_to
    AND (
      p_transfer_type = 'all' 
      OR (p_transfer_type = 'transfer' AND ce.event_type = 'transfer')
      OR (p_transfer_type = 'return' AND ce.event_type = 'return')
      OR (p_transfer_type = 'share' AND ce.event_type = 'share')
    )
    AND (
      p_from_user_id IS NULL 
      OR (ce.data->>'from_user_id')::UUID = p_from_user_id
      OR (ce.event_type = 'share' AND ce.actor_id = p_from_user_id)
    )
    AND (
      p_to_user_id IS NULL 
      OR (ce.data->>'to_user_id')::UUID = p_to_user_id
      OR (ce.data->>'shared_with_user_id')::UUID = p_to_user_id
    )
    AND (
      p_from_department_id IS NULL 
      OR (ce.data->>'from_department_id')::UUID = p_from_department_id
    )
    AND (
      p_to_department_id IS NULL 
      OR (ce.data->>'to_department_id')::UUID = p_to_department_id
      OR (ce.data->>'shared_with_department_id')::UUID = p_to_department_id
    )
    AND (
      p_search_query IS NULL 
      OR ct.full_name ILIKE '%' || p_search_query || '%'
      OR ct.phone ILIKE '%' || p_search_query || '%'
    )
  ORDER BY ce.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;