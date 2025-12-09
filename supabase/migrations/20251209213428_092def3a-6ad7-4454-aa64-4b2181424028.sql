-- Atualizar a função para considerar apenas contatos com conversas ativas (open/pending)
CREATE OR REPLACE FUNCTION public.get_lead_status_summary(_user_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(lead_status text, contact_count bigint, total_value numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Se não passou user_id ou é admin/supervisor, retorna todos
  IF _user_id IS NULL OR can_view_all_data(_user_id) THEN
    RETURN QUERY
    SELECT 
      COALESCE(c.lead_status, '__no_status__') as lead_status,
      COUNT(*)::BIGINT as contact_count,
      COALESCE(SUM(c.negotiated_value), 0)::NUMERIC as total_value
    FROM contacts c
    WHERE EXISTS (
      SELECT 1 FROM conversations conv 
      WHERE conv.contact_id = c.id 
      AND conv.status IN ('open', 'pending')
    )
    GROUP BY c.lead_status
    ORDER BY contact_count DESC;
  ELSE
    -- Usuário comum: só vê contacts atribuídos a ele
    RETURN QUERY
    SELECT 
      COALESCE(c.lead_status, '__no_status__') as lead_status,
      COUNT(*)::BIGINT as contact_count,
      COALESCE(SUM(c.negotiated_value), 0)::NUMERIC as total_value
    FROM contacts c
    WHERE c.assigned_to = _user_id
    AND EXISTS (
      SELECT 1 FROM conversations conv 
      WHERE conv.contact_id = c.id 
      AND conv.status IN ('open', 'pending')
    )
    GROUP BY c.lead_status
    ORDER BY contact_count DESC;
  END IF;
END;
$function$;