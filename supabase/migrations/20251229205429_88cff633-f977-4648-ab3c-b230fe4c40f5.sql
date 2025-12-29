-- =====================================================
-- Atualizar RPCs para incluir campos de Dados de Aquisição
-- (origin_campaign e referral_data)
-- =====================================================

-- 1. Atualizar search_contacts_paginated para incluir origin_campaign e referral_data
DROP FUNCTION IF EXISTS public.search_contacts_paginated(text, text, text, uuid, uuid, integer, integer);

CREATE OR REPLACE FUNCTION public.search_contacts_paginated(
  p_search_query text DEFAULT NULL::text, 
  p_state_filter text DEFAULT NULL::text, 
  p_status_filter text DEFAULT NULL::text, 
  p_assigned_to uuid DEFAULT NULL::uuid, 
  p_department_id uuid DEFAULT NULL::uuid, 
  p_offset integer DEFAULT 0, 
  p_limit integer DEFAULT 50
) RETURNS TABLE(
  id uuid, 
  full_name text, 
  phone text, 
  email text, 
  avatar_url text, 
  state text, 
  city text, 
  lead_status text, 
  first_contact_at timestamp with time zone, 
  last_interaction_at timestamp with time zone, 
  assigned_to uuid, 
  department_id uuid, 
  is_online boolean, 
  created_at timestamp with time zone, 
  updated_at timestamp with time zone, 
  notes text, 
  cpf_cnpj text, 
  birth_date date, 
  street text, 
  "number" text, 
  complement text, 
  neighborhood text, 
  zip_code text, 
  country text, 
  person_type text, 
  origin text, 
  custom_fields jsonb, 
  origin_campaign text,
  referral_data jsonb,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_total bigint;
  v_user_tenant UUID;
BEGIN
  -- CRITICAL: Get user's tenant_id for isolation
  v_user_tenant := get_user_tenant_id();
  IF v_user_tenant IS NULL THEN
    RETURN;
  END IF;

  -- Contar total COM TENANT FILTER
  SELECT COUNT(*) INTO v_total
  FROM contacts c
  WHERE c.tenant_id = v_user_tenant
    AND (p_search_query IS NULL OR p_search_query = '' OR 
         immutable_unaccent(lower(c.full_name)) ILIKE '%' || immutable_unaccent(lower(p_search_query)) || '%' OR 
         c.phone ILIKE '%' || p_search_query || '%' OR 
         c.email ILIKE '%' || p_search_query || '%')
    AND (p_state_filter IS NULL OR c.state = p_state_filter)
    AND (p_status_filter IS NULL OR c.lead_status = p_status_filter)
    AND (p_assigned_to IS NULL OR c.assigned_to = p_assigned_to)
    AND (p_department_id IS NULL OR c.department_id = p_department_id);

  -- Retornar resultados paginados COM TENANT FILTER
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
    c.origin_campaign,
    c.referral_data,
    v_total as total_count
  FROM contacts c
  WHERE c.tenant_id = v_user_tenant
    AND (p_search_query IS NULL OR p_search_query = '' OR 
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
$function$;

-- 2. Atualizar get_contacts_by_tag_filter para incluir origin_campaign e referral_data
DROP FUNCTION IF EXISTS public.get_contacts_by_tag_filter(uuid[], text, text, text, uuid, uuid, integer, integer);

CREATE OR REPLACE FUNCTION public.get_contacts_by_tag_filter(
  p_tag_ids uuid[], 
  p_search_query text DEFAULT NULL::text, 
  p_state_filter text DEFAULT NULL::text, 
  p_status_filter text DEFAULT NULL::text, 
  p_assigned_to uuid DEFAULT NULL::uuid, 
  p_department_id uuid DEFAULT NULL::uuid, 
  p_offset integer DEFAULT 0, 
  p_limit integer DEFAULT 50
) RETURNS TABLE(
  contact_id uuid, 
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_total bigint;
  v_user_tenant UUID;
BEGIN
  -- CRITICAL: Get user's tenant_id for isolation
  v_user_tenant := get_user_tenant_id();
  IF v_user_tenant IS NULL THEN
    RETURN;
  END IF;

  -- Primeiro conta o total COM TENANT FILTER
  SELECT COUNT(DISTINCT c.id) INTO v_total
  FROM contacts c
  INNER JOIN contact_tags ct ON ct.contact_id = c.id
  WHERE c.tenant_id = v_user_tenant
    AND ct.tenant_id = v_user_tenant
    AND ct.tag_id = ANY(p_tag_ids)
    AND (p_search_query IS NULL OR p_search_query = '' OR 
         immutable_unaccent(lower(c.full_name)) ILIKE '%' || immutable_unaccent(lower(p_search_query)) || '%' OR 
         c.phone ILIKE '%' || p_search_query || '%' OR 
         c.email ILIKE '%' || p_search_query || '%')
    AND (p_state_filter IS NULL OR c.state = p_state_filter)
    AND (p_status_filter IS NULL OR c.lead_status = p_status_filter)
    AND (p_assigned_to IS NULL OR c.assigned_to = p_assigned_to)
    AND (p_department_id IS NULL OR c.department_id = p_department_id);

  -- Retorna os IDs paginados com o total COM TENANT FILTER
  RETURN QUERY
  SELECT DISTINCT c.id as contact_id, v_total as total_count
  FROM contacts c
  INNER JOIN contact_tags ct ON ct.contact_id = c.id
  WHERE c.tenant_id = v_user_tenant
    AND ct.tenant_id = v_user_tenant
    AND ct.tag_id = ANY(p_tag_ids)
    AND (p_search_query IS NULL OR p_search_query = '' OR 
         immutable_unaccent(lower(c.full_name)) ILIKE '%' || immutable_unaccent(lower(p_search_query)) || '%' OR 
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
$function$;