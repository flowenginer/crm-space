-- Função helper para verificar se usuário pode ver todos os dados (admin/supervisor)
CREATE OR REPLACE FUNCTION public.can_view_all_data(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = _user_id
    AND role IN ('admin', 'supervisor')
  );
$$;

-- Atualizar função RPC get_lead_status_summary para filtrar por usuário
DROP FUNCTION IF EXISTS public.get_lead_status_summary();

CREATE OR REPLACE FUNCTION public.get_lead_status_summary(_user_id uuid DEFAULT NULL)
RETURNS TABLE(lead_status text, contact_count bigint, total_value numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se não passou user_id ou é admin/supervisor, retorna todos
  IF _user_id IS NULL OR can_view_all_data(_user_id) THEN
    RETURN QUERY
    SELECT 
      COALESCE(c.lead_status, '__no_status__') as lead_status,
      COUNT(*)::BIGINT as contact_count,
      COALESCE(SUM(c.negotiated_value), 0)::NUMERIC as total_value
    FROM contacts c
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
    GROUP BY c.lead_status
    ORDER BY contact_count DESC;
  END IF;
END;
$$;