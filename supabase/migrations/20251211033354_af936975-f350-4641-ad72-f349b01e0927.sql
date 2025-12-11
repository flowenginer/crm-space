DROP FUNCTION IF EXISTS get_kanban_contacts_optimized(uuid, integer);

CREATE OR REPLACE FUNCTION get_kanban_contacts_optimized(
  _user_id uuid,
  _limit_per_status integer DEFAULT 20
)
RETURNS TABLE (
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
  assignee_avatar text,
  conversation_id uuid,
  unread_count integer
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin_user boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = _user_id 
    AND role IN ('admin', 'supervisor')
  ) INTO is_admin_user;

  RETURN QUERY
  WITH ranked_contacts AS (
    SELECT 
      c.id as contact_id,
      c.full_name,
      c.phone,
      c.email,
      c.avatar_url,
      c.lead_status,
      c.assigned_to,
      c.updated_at,
      c.negotiated_value,
      p.id as assignee_id,
      p.full_name as assignee_name,
      p.avatar_url as assignee_avatar,
      conv.id as conversation_id,
      conv.conv_unread_count as unread_count,
      ROW_NUMBER() OVER (
        PARTITION BY COALESCE(c.lead_status, 'no_status') 
        ORDER BY c.updated_at DESC
      ) as rn
    FROM contacts c
    LEFT JOIN profiles p ON c.assigned_to = p.id
    LEFT JOIN LATERAL (
      SELECT conversations.id, conversations.unread_count as conv_unread_count
      FROM conversations 
      WHERE conversations.contact_id = c.id 
      ORDER BY conversations.updated_at DESC 
      LIMIT 1
    ) conv ON true
    WHERE 
      is_admin_user 
      OR c.assigned_to = _user_id
      OR EXISTS (
        SELECT 1 FROM conversations cv
        WHERE cv.contact_id = c.id
        AND cv.status IN ('open', 'pending')
        AND (
          cv.assigned_to = _user_id
          OR (cv.assigned_to IS NULL AND cv.department_id IN (
            SELECT department_id FROM user_departments WHERE user_id = _user_id
            UNION
            SELECT department_id FROM profiles WHERE id = _user_id AND department_id IS NOT NULL
          ))
        )
      )
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
    rc.assignee_avatar,
    rc.conversation_id,
    rc.unread_count
  FROM ranked_contacts rc
  WHERE rc.rn <= _limit_per_status;
END;
$$;