-- Primeiro dropar a função existente e recriar com novos campos
DROP FUNCTION IF EXISTS public.search_contacts_for_erp(text, integer);

-- Recriar função com campos de endereço
CREATE FUNCTION public.search_contacts_for_erp(
  search_term TEXT,
  result_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  phone TEXT,
  email TEXT,
  cpf_cnpj TEXT,
  zip_code TEXT,
  street TEXT,
  number TEXT,
  neighborhood TEXT,
  city TEXT,
  state TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.full_name::TEXT,
    c.phone::TEXT,
    c.email::TEXT,
    c.cpf_cnpj::TEXT,
    c.zip_code::TEXT,
    c.street::TEXT,
    c.number::TEXT,
    c.neighborhood::TEXT,
    c.city::TEXT,
    c.state::TEXT
  FROM contacts c
  WHERE 
    search_term = '' 
    OR c.full_name ILIKE '%' || search_term || '%'
    OR c.phone ILIKE '%' || search_term || '%'
    OR c.email ILIKE '%' || search_term || '%'
    OR c.cpf_cnpj ILIKE '%' || search_term || '%'
  ORDER BY c.full_name
  LIMIT result_limit;
END;
$function$;