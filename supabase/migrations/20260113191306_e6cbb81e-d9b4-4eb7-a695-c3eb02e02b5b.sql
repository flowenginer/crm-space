-- Criar função otimizada que já filtra por assigned_to para vendedores
CREATE OR REPLACE FUNCTION search_contacts_by_assignment(
  p_search_term TEXT,
  p_assigned_to UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE(id UUID) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_tenant UUID;
BEGIN
  -- CRITICAL: Get user's tenant_id for isolation
  v_user_tenant := get_user_tenant_id();
  IF v_user_tenant IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT c.id
  FROM contacts c
  WHERE c.tenant_id = v_user_tenant
    AND (
      immutable_unaccent(lower(c.full_name)) ILIKE '%' || immutable_unaccent(lower(p_search_term)) || '%'
      OR c.phone ILIKE '%' || p_search_term || '%'
    )
    AND (p_assigned_to IS NULL OR c.assigned_to = p_assigned_to)
  ORDER BY 
    -- Priorizar contatos atribuídos ao usuário quando houver filtro
    CASE WHEN p_assigned_to IS NOT NULL AND c.assigned_to = p_assigned_to THEN 0 ELSE 1 END,
    c.full_name
  LIMIT p_limit;
END;
$$;