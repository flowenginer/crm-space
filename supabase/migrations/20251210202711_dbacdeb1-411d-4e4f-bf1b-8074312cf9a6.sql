-- Criar função RPC para busca de contatos ignorando acentos
CREATE OR REPLACE FUNCTION search_contacts_unaccent(p_search_term TEXT)
RETURNS TABLE(id UUID) AS $$
BEGIN
  RETURN QUERY
  SELECT c.id
  FROM contacts c
  WHERE unaccent(lower(c.full_name)) ILIKE '%' || unaccent(lower(p_search_term)) || '%'
     OR unaccent(lower(c.phone)) ILIKE '%' || unaccent(lower(p_search_term)) || '%'
  LIMIT 100;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;