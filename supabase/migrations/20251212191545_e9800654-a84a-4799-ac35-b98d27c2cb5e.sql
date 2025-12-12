
CREATE OR REPLACE FUNCTION public.get_kanban_contacts_optimized(
  p_limit_per_status integer DEFAULT 50
)
RETURNS TABLE(
  id uuid,
  full_name text,
  phone text,
  email text,
  lead_status text,
  negotiated_value numeric,
  assigned_to uuid,
  assigned_name text,
  lead_status_changed_at timestamptz,
  has_open_conversation boolean,
  unread_count integer,
  conversation_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _user_role text;
  _user_dept_ids uuid[];
  is_admin_user boolean;
BEGIN
  -- Get user role
  SELECT role INTO _user_role
  FROM profiles
  WHERE profiles.id = _user_id;

  -- Get user departments
  SELECT ARRAY_AGG(department_id) INTO _user_dept_ids
  FROM user_departments
  WHERE user_id = _user_id;

  -- Check if admin/supervisor
  is_admin_user := _user_role IN ('admin', 'super_admin', 'supervisor');

  RETURN QUERY
  WITH ranked_contacts AS (
    SELECT 
      c.id,
      c.full_name,
      c.phone,
      c.email,
      c.lead_status,
      c.negotiated_value,
      c.assigned_to,
      p.full_name as assigned_name,
      c.lead_status_changed_at,
      EXISTS (
        SELECT 1 FROM conversations cv 
        WHERE cv.contact_id = c.id 
        AND cv.status IN ('open', 'pending')
      ) as has_open_conversation,
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
        ORDER BY c.lead_status_changed_at DESC NULLS LAST
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
    rc.id,
    rc.full_name,
    rc.phone,
    rc.email,
    rc.lead_status,
    rc.negotiated_value,
    rc.assigned_to,
    rc.assigned_name,
    rc.lead_status_changed_at,
    rc.has_open_conversation,
    rc.unread_count,
    rc.conversation_id
  FROM ranked_contacts rc
  WHERE rc.rn <= p_limit_per_status;
END;
$$;
