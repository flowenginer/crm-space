
-- Drop and recreate function with search parameter
DROP FUNCTION IF EXISTS get_transfer_history(timestamp with time zone, timestamp with time zone, uuid, uuid, uuid, uuid, text, integer, integer);

CREATE OR REPLACE FUNCTION get_transfer_history(
  p_date_from timestamp with time zone,
  p_date_to timestamp with time zone,
  p_from_user_id uuid DEFAULT NULL,
  p_to_user_id uuid DEFAULT NULL,
  p_from_department_id uuid DEFAULT NULL,
  p_to_department_id uuid DEFAULT NULL,
  p_transfer_type text DEFAULT 'all',
  p_search_query text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  conversation_id uuid,
  contact_id uuid,
  contact_name text,
  contact_phone text,
  transferred_at timestamp with time zone,
  from_user_id uuid,
  from_user_name text,
  to_user_id uuid,
  to_user_name text,
  from_department_id uuid,
  from_department_name text,
  to_department_id uuid,
  to_department_name text,
  transfer_note text,
  is_return boolean,
  actor_id uuid,
  actor_name text,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total bigint;
BEGIN
  -- Count total records
  SELECT COUNT(*) INTO total
  FROM conversation_events ce
  JOIN conversations conv ON conv.id = ce.conversation_id
  JOIN contacts c ON c.id = conv.contact_id
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
    AND (
      p_search_query IS NULL 
      OR p_search_query = ''
      OR c.full_name ILIKE '%' || p_search_query || '%'
      OR c.phone ILIKE '%' || p_search_query || '%'
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
    from_profile.full_name AS from_user_name,
    (ce.data->>'to_user_id')::uuid AS to_user_id,
    to_profile.full_name AS to_user_name,
    (ce.data->>'from_department_id')::uuid AS from_department_id,
    from_dept.name AS from_department_name,
    (ce.data->>'to_department_id')::uuid AS to_department_id,
    to_dept.name AS to_department_name,
    ce.data->>'note' AS transfer_note,
    COALESCE((ce.data->>'is_return')::boolean, false) AS is_return,
    ce.actor_id,
    actor_profile.full_name AS actor_name,
    total AS total_count
  FROM conversation_events ce
  JOIN conversations conv ON conv.id = ce.conversation_id
  JOIN contacts c ON c.id = conv.contact_id
  LEFT JOIN profiles from_profile ON from_profile.id = (ce.data->>'from_user_id')::uuid
  LEFT JOIN profiles to_profile ON to_profile.id = (ce.data->>'to_user_id')::uuid
  LEFT JOIN profiles actor_profile ON actor_profile.id = ce.actor_id
  LEFT JOIN departments from_dept ON from_dept.id = (ce.data->>'from_department_id')::uuid
  LEFT JOIN departments to_dept ON to_dept.id = (ce.data->>'to_department_id')::uuid
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
    AND (
      p_search_query IS NULL 
      OR p_search_query = ''
      OR c.full_name ILIKE '%' || p_search_query || '%'
      OR c.phone ILIKE '%' || p_search_query || '%'
    )
  ORDER BY ce.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;
