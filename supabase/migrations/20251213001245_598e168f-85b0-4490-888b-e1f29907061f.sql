-- Função RPC para buscar contatos no ERP (ignora RLS restritivo)
-- Permite que vendedores vejam todos os contatos da empresa para criar orçamentos/pedidos

CREATE OR REPLACE FUNCTION public.search_contacts_for_erp(
  search_term TEXT DEFAULT '',
  result_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  phone TEXT,
  email TEXT,
  cpf_cnpj TEXT,
  city TEXT,
  state TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Retorna contatos básicos para seleção em orçamentos/pedidos
  -- SECURITY DEFINER permite ignorar RLS, mas filtramos por autenticação
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    c.id,
    c.full_name,
    c.phone,
    c.email,
    c.cpf_cnpj,
    c.city,
    c.state
  FROM contacts c
  WHERE 
    search_term = '' OR
    c.full_name ILIKE '%' || search_term || '%' OR
    c.phone ILIKE '%' || search_term || '%' OR
    c.email ILIKE '%' || search_term || '%' OR
    c.cpf_cnpj ILIKE '%' || search_term || '%'
  ORDER BY c.full_name
  LIMIT result_limit;
END;
$$;

-- Conceder permissão para usuários autenticados
GRANT EXECUTE ON FUNCTION public.search_contacts_for_erp(TEXT, INTEGER) TO authenticated;