-- Drop and recreate the function with conversation data
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
  unread_count bigint
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin_user boolean;
BEGIN
  -- Check if user is admin/supervisor
  SELECT role IN ('admin', 'supervisor') INTO is_admin_user
  FROM profiles WHERE id = _user_id;

  RETURN QUERY
  WITH ranked_contacts AS (
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
      conv_data.conv_id as conversation_id,
      COALESCE(conv_data.unread_count, 0) as unread_count,
      ROW_NUMBER() OVER (
        PARTITION BY COALESCE(c.lead_status, '__no_status__')
        ORDER BY c.updated_at DESC
      ) as rn
    FROM contacts c
    LEFT JOIN profiles p ON c.assigned_to = p.id
    LEFT JOIN LATERAL (
      SELECT conv.id as conv_id, COALESCE(conv.unread_count, 0) as unread_count
      FROM conversations conv
      WHERE conv.contact_id = c.id
        AND conv.status IN ('open', 'pending')
      ORDER BY conv.last_message_at DESC NULLS LAST
      LIMIT 1
    ) conv_data ON true
    WHERE 
      is_admin_user 
      OR c.assigned_to = _user_id 
      OR c.assigned_to IS NULL
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