-- Create function to get original agents for contacts (first assigned agent)
CREATE OR REPLACE FUNCTION get_original_agents_for_contacts(contact_ids uuid[])
RETURNS TABLE (
  contact_id uuid,
  original_agent_id uuid,
  original_agent_name text,
  original_department_id uuid
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (lah.contact_id)
    lah.contact_id,
    lah.assigned_to as original_agent_id,
    p.full_name as original_agent_name,
    p.department_id as original_department_id
  FROM lead_assignment_history lah
  LEFT JOIN profiles p ON p.id = lah.assigned_to
  WHERE lah.contact_id = ANY(contact_ids)
    AND lah.assignment_type = 'first_assignment'
    AND lah.assigned_to IS NOT NULL
  ORDER BY lah.contact_id, lah.assigned_at ASC;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_original_agents_for_contacts(uuid[]) TO authenticated;