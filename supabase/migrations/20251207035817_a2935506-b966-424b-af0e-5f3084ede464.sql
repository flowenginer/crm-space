-- Função para retornar contagens agregadas de contatos
CREATE OR REPLACE FUNCTION public.get_contact_filter_counts()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'byState', COALESCE((
      SELECT json_object_agg(state, cnt)
      FROM (
        SELECT state, COUNT(*) as cnt 
        FROM contacts 
        WHERE state IS NOT NULL 
        GROUP BY state
      ) s
    ), '{}'::json),
    'byStatus', COALESCE((
      SELECT json_object_agg(COALESCE(lead_status, 'sem_status'), cnt)
      FROM (
        SELECT lead_status, COUNT(*) as cnt 
        FROM contacts 
        GROUP BY lead_status
      ) s
    ), '{}'::json),
    'byAssignee', COALESCE((
      SELECT json_object_agg(assigned_to::text, cnt)
      FROM (
        SELECT assigned_to, COUNT(*) as cnt 
        FROM contacts 
        WHERE assigned_to IS NOT NULL 
        GROUP BY assigned_to
      ) s
    ), '{}'::json)
  ) INTO result;
  
  RETURN result;
END;
$$;