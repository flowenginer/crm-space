
-- Drop both versions of the function
DROP FUNCTION IF EXISTS public.get_kanban_contacts_optimized(integer);
DROP FUNCTION IF EXISTS public.get_kanban_contacts_optimized(uuid, integer);

-- Recreate with the correct signature and logic
CREATE OR REPLACE FUNCTION public.get_kanban_contacts_optimized(
  _user_id uuid,
  _limit_per_status integer DEFAULT 50
)
RETURNS TABLE(
  contact_id uuid,
  full_name text,
  phone text,
  email text,
  avatar_url text,
  lead_status text,
  negotiated_value numeric,
  assigned_to uuid,
  assignee_id uuid,
  assignee_name text,
  assignee_avatar text,
  updated_at timestamptz,
  unread_count integer,
  conversation_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_role text;
  is_admin_user boolean;
BEGIN
  -- Get user role
  SELECT role INTO _user_role
  FROM profiles
  WHERE profiles.id = _user_id;

  -- Check if admin/supervisor
  is_admin_user := _user_role IN ('admin', 'super_admin', 'supervisor');

  RETURN QUERY
  WITH ranked_contacts AS (
    SELECT 
      c.id as contact_id,
      c.full_name,
      c.phone,
      c.email,
      c.avatar_url,
      c.lead_status,
      c.negotiated_value,
      c.assigned_to,
      p.id as assignee_id,
      p.full_name as assignee_name,
      p.avatar_url as assignee_avatar,
      c.updated_at,
      COALESCE((
        SELECT SUM(cv.unread_count)::integer 
        FROM conversations cv 
        WHERE cv.contact_id = c.id
      ), 0) as unread_count,
      (
        SELECT cv.id 
        FROM conversations cv 
        WHERE cv.contact_id = c.id 
        ORDER BY cv.last_message_at DESC NULLS LAST 
        LIMIT 1
      ) as conversation_id,
      ROW_NUMBER() OVER (
        PARTITION BY COALESCE(c.lead_status, '__no_status__')
        ORDER BY c.updated_at DESC NULLS LAST
      ) as rn
    FROM contacts c
    LEFT JOIN profiles p ON p.id = c.assigned_to
    WHERE 
      -- Admins veem tudo
      is_admin_user 
      -- Contato atribuído diretamente ao usuário
      OR c.assigned_to = _user_id
      -- Usuário tem conversa atribuída a ele com este contato
      OR EXISTS (
        SELECT 1 FROM conversations cv
        WHERE cv.contact_id = c.id
        AND cv.status IN ('open', 'pending')
        AND cv.assigned_to = _user_id
      )
  )
  SELECT 
    rc.contact_id,
    rc.full_name,
    rc.phone,
    rc.email,
    rc.avatar_url,
    rc.lead_status,
    rc.negotiated_value,
    rc.assigned_to,
    rc.assignee_id,
    rc.assignee_name,
    rc.assignee_avatar,
    rc.updated_at,
    rc.unread_count,
    rc.conversation_id
  FROM ranked_contacts rc
  WHERE rc.rn <= _limit_per_status;
END;
$$;
