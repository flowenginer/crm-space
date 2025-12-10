-- Habilitar extensão unaccent
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Criar função imutável para usar em índices (sintaxe correta)
CREATE OR REPLACE FUNCTION public.immutable_unaccent(text)
RETURNS text AS $$
  SELECT public.unaccent($1)
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE;

-- Criar índice funcional para busca otimizada
CREATE INDEX IF NOT EXISTS idx_contacts_full_name_unaccent 
ON contacts (immutable_unaccent(lower(full_name)));

-- Criar função RPC para busca de contatos insensível a acentos
CREATE OR REPLACE FUNCTION public.search_contacts_unaccent(
  p_search_query text,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  full_name text,
  phone text,
  email text,
  avatar_url text,
  assigned_to uuid,
  lead_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.full_name,
    c.phone,
    c.email,
    c.avatar_url,
    c.assigned_to,
    c.lead_status
  FROM contacts c
  WHERE 
    immutable_unaccent(lower(c.full_name)) ILIKE '%' || immutable_unaccent(lower(p_search_query)) || '%'
    OR c.phone ILIKE '%' || p_search_query || '%'
    OR c.email ILIKE '%' || p_search_query || '%'
  ORDER BY c.full_name
  LIMIT p_limit;
END;
$$;

-- Atualizar a função get_contacts_by_tag_filter para usar unaccent
CREATE OR REPLACE FUNCTION public.get_contacts_by_tag_filter(
  p_tag_ids uuid[], 
  p_search_query text DEFAULT NULL::text, 
  p_state_filter text DEFAULT NULL::text, 
  p_status_filter text DEFAULT NULL::text, 
  p_assigned_to uuid DEFAULT NULL::uuid, 
  p_department_id uuid DEFAULT NULL::uuid, 
  p_offset integer DEFAULT 0, 
  p_limit integer DEFAULT 50
)
RETURNS TABLE(contact_id uuid, total_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
         immutable_unaccent(lower(c.full_name)) ILIKE '%' || immutable_unaccent(lower(p_search_query)) || '%' OR 
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
$$;