-- Criar função RPC para busca paginada de contatos com unaccent
CREATE OR REPLACE FUNCTION public.search_contacts_paginated(
  p_search_query text DEFAULT NULL,
  p_state_filter text DEFAULT NULL,
  p_status_filter text DEFAULT NULL,
  p_assigned_to uuid DEFAULT NULL,
  p_department_id uuid DEFAULT NULL,
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  full_name text,
  phone text,
  email text,
  avatar_url text,
  state text,
  city text,
  lead_status text,
  first_contact_at timestamptz,
  last_interaction_at timestamptz,
  assigned_to uuid,
  department_id uuid,
  is_online boolean,
  created_at timestamptz,
  updated_at timestamptz,
  notes text,
  cpf_cnpj text,
  birth_date date,
  street text,
  number text,
  complement text,
  neighborhood text,
  zip_code text,
  country text,
  person_type text,
  origin text,
  custom_fields jsonb,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total bigint;
BEGIN
  -- Contar total
  SELECT COUNT(*) INTO v_total
  FROM contacts c
  WHERE (p_search_query IS NULL OR p_search_query = '' OR 
         immutable_unaccent(lower(c.full_name)) ILIKE '%' || immutable_unaccent(lower(p_search_query)) || '%' OR 
         c.phone ILIKE '%' || p_search_query || '%' OR 
         c.email ILIKE '%' || p_search_query || '%')
    AND (p_state_filter IS NULL OR c.state = p_state_filter)
    AND (p_status_filter IS NULL OR c.lead_status = p_status_filter)
    AND (p_assigned_to IS NULL OR c.assigned_to = p_assigned_to)
    AND (p_department_id IS NULL OR c.department_id = p_department_id);

  -- Retornar resultados paginados
  RETURN QUERY
  SELECT 
    c.id,
    c.full_name,
    c.phone,
    c.email,
    c.avatar_url,
    c.state,
    c.city,
    c.lead_status,
    c.first_contact_at,
    c.last_interaction_at,
    c.assigned_to,
    c.department_id,
    c.is_online,
    c.created_at,
    c.updated_at,
    c.notes,
    c.cpf_cnpj,
    c.birth_date,
    c.street,
    c.number,
    c.complement,
    c.neighborhood,
    c.zip_code,
    c.country,
    c.person_type,
    c.origin,
    c.custom_fields,
    v_total as total_count
  FROM contacts c
  WHERE (p_search_query IS NULL OR p_search_query = '' OR 
         immutable_unaccent(lower(c.full_name)) ILIKE '%' || immutable_unaccent(lower(p_search_query)) || '%' OR 
         c.phone ILIKE '%' || p_search_query || '%' OR 
         c.email ILIKE '%' || p_search_query || '%')
    AND (p_state_filter IS NULL OR c.state = p_state_filter)
    AND (p_status_filter IS NULL OR c.lead_status = p_status_filter)
    AND (p_assigned_to IS NULL OR c.assigned_to = p_assigned_to)
    AND (p_department_id IS NULL OR c.department_id = p_department_id)
  ORDER BY c.created_at DESC
  OFFSET p_offset
  LIMIT p_limit;
END;
$$;