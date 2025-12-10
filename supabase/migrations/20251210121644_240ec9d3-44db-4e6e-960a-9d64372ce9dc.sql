-- Função auxiliar para verificar se usuário pode ver todos os dados
CREATE OR REPLACE FUNCTION can_view_all_data(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role FROM profiles WHERE id = _user_id;
  RETURN user_role IN ('admin', 'supervisor');
END;
$$;

-- Função RPC otimizada para buscar todos os contatos do Kanban de uma vez
CREATE OR REPLACE FUNCTION get_kanban_contacts_optimized(
  _user_id uuid DEFAULT NULL,
  _limit_per_status int DEFAULT 20
)
RETURNS TABLE(
  contact_id uuid,
  full_name text,
  phone text,
  email text,
  avatar_url text,
  lead_status text,
  assigned_to uuid,
  updated_at timestamptz,
  negotiated_value numeric,
  assignee_id uuid,
  assignee_name text,
  assignee_avatar text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  can_view_all boolean;
BEGIN
  -- Verificar se usuário pode ver todos os dados
  can_view_all := can_view_all_data(_user_id);

  RETURN QUERY
  WITH active_contact_ids AS (
    -- Buscar IDs únicos de contatos com conversas ativas
    SELECT DISTINCT conv.contact_id
    FROM conversations conv
    WHERE conv.status IN ('open', 'pending')
  ),
  ranked_contacts AS (
    SELECT 
      c.id as contact_id,
      c.full_name,
      c.phone,
      c.email,
      c.avatar_url,
      COALESCE(c.lead_status, '__no_status__') as lead_status,
      c.assigned_to,
      c.updated_at,
      c.negotiated_value,
      p.id as assignee_id,
      p.full_name as assignee_name,
      p.avatar_url as assignee_avatar,
      ROW_NUMBER() OVER (
        PARTITION BY COALESCE(c.lead_status, '__no_status__') 
        ORDER BY c.updated_at DESC
      ) as rn
    FROM contacts c
    LEFT JOIN profiles p ON p.id = c.assigned_to
    WHERE c.id IN (SELECT aci.contact_id FROM active_contact_ids aci)
      AND (can_view_all OR c.assigned_to = _user_id)
  )
  SELECT 
    rc.contact_id,
    rc.full_name,
    rc.phone,
    rc.email,
    rc.avatar_url,
    rc.lead_status,
    rc.assigned_to,
    rc.updated_at,
    rc.negotiated_value,
    rc.assignee_id,
    rc.assignee_name,
    rc.assignee_avatar
  FROM ranked_contacts rc
  WHERE rc.rn <= _limit_per_status
  ORDER BY rc.lead_status, rc.updated_at DESC;
END;
$$;

-- Índice composto para otimizar a busca de conversas ativas
CREATE INDEX IF NOT EXISTS idx_conversations_contact_status 
ON conversations(contact_id, status);