-- Função RPC para buscar contato pelos últimos 8 dígitos do telefone
-- Isso previne duplicação de contatos por variação do 9° dígito

CREATE OR REPLACE FUNCTION find_contact_by_phone_suffix(phone_suffix text)
RETURNS TABLE (
  id uuid,
  full_name text,
  phone text,
  assigned_to uuid,
  department_id uuid,
  avatar_url text,
  email text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.full_name,
    c.phone,
    c.assigned_to,
    c.department_id,
    c.avatar_url,
    c.email
  FROM contacts c
  WHERE c.phone LIKE '%' || phone_suffix
  ORDER BY c.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar índice para otimizar buscas por sufixo de telefone
CREATE INDEX IF NOT EXISTS idx_contacts_phone_suffix 
ON contacts (RIGHT(phone, 8));

-- Comentário explicativo
COMMENT ON FUNCTION find_contact_by_phone_suffix IS 
'Busca contato pelos últimos 8 dígitos do telefone. 
Previne duplicação de contatos quando há variação do 9° dígito brasileiro.
Ex: 5591985500488 e 559185500488 seriam o mesmo contato.';