-- Função RPC para buscar contatos por tags (evita limite de URL)
CREATE OR REPLACE FUNCTION get_contacts_by_tag_filter(
  p_tag_ids uuid[],
  p_search_query text DEFAULT NULL,
  p_state_filter text DEFAULT NULL,
  p_status_filter text DEFAULT NULL,
  p_assigned_to uuid DEFAULT NULL,
  p_department_id uuid DEFAULT NULL,
  p_offset int DEFAULT 0,
  p_limit int DEFAULT 50
)
RETURNS TABLE(
  contact_id uuid,
  total_count bigint
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total bigint;
BEGIN
  -- Primeiro conta o total
  SELECT COUNT(DISTINCT c.id) INTO v_total
  FROM contacts c
  INNER JOIN contact_tags ct ON ct.contact_id = c.id
  WHERE ct.tag_id = ANY(p_tag_ids)
    AND (p_search_query IS NULL OR p_search_query = '' OR 
         c.full_name ILIKE '%' || p_search_query || '%' OR 
         c.phone ILIKE '%' || p_search_query || '%' OR 
         c.email ILIKE '%' || p_search_query || '%')
    AND (p_state_filter IS NULL OR c.state = p_state_filter)
    AND (p_status_filter IS NULL OR c.lead_status = p_status_filter)
    AND (p_assigned_to IS NULL OR c.assigned_to = p_assigned_to)
    AND (p_department_id IS NULL OR c.department_id = p_department_id);

  -- Retorna os IDs paginados com o total
  RETURN QUERY
  SELECT DISTINCT c.id as contact_id, v_total as total_count
  FROM contacts c
  INNER JOIN contact_tags ct ON ct.contact_id = c.id
  WHERE ct.tag_id = ANY(p_tag_ids)
    AND (p_search_query IS NULL OR p_search_query = '' OR 
         c.full_name ILIKE '%' || p_search_query || '%' OR 
         c.phone ILIKE '%' || p_search_query || '%' OR 
         c.email ILIKE '%' || p_search_query || '%')
    AND (p_state_filter IS NULL OR c.state = p_state_filter)
    AND (p_status_filter IS NULL OR c.lead_status = p_status_filter)
    AND (p_assigned_to IS NULL OR c.assigned_to = p_assigned_to)
    AND (p_department_id IS NULL OR c.department_id = p_department_id)
  ORDER BY c.id
  OFFSET p_offset
  LIMIT p_limit;
END;
$$;