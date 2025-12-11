-- Fix RLS policies for internal_chat_participants to avoid infinite recursion
DROP POLICY IF EXISTS "users_can_view_own_participations" ON internal_chat_participants;
DROP POLICY IF EXISTS "users_can_update_own_participations" ON internal_chat_participants;
DROP POLICY IF EXISTS "users_can_insert_participations" ON internal_chat_participants;
DROP POLICY IF EXISTS "Users can view their own participations" ON internal_chat_participants;
DROP POLICY IF EXISTS "Users can update their own participations" ON internal_chat_participants;
DROP POLICY IF EXISTS "Users can insert participations" ON internal_chat_participants;

-- Create simple policies that don't cause recursion
CREATE POLICY "simple_select_own_participations" ON internal_chat_participants
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "simple_update_own_participations" ON internal_chat_participants
FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "simple_insert_participations" ON internal_chat_participants
FOR INSERT WITH CHECK (user_id = auth.uid() OR EXISTS (
  SELECT 1 FROM internal_chat_participants 
  WHERE thread_id = internal_chat_participants.thread_id 
  AND user_id = auth.uid()
));

-- Create optimized function to get threads with all data in one call
CREATE OR REPLACE FUNCTION public.get_internal_chat_threads(p_user_id uuid)
RETURNS TABLE (
  thread_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  last_message_at timestamptz,
  last_message_preview text,
  last_message_sender_id uuid,
  unread_count integer,
  other_user_id uuid,
  other_user_name text,
  other_user_avatar text,
  other_user_online boolean,
  other_user_department_id uuid,
  other_user_department_name text,
  other_user_department_color text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id as thread_id,
    t.created_at,
    t.updated_at,
    t.last_message_at,
    t.last_message_preview,
    t.last_message_sender_id,
    COALESCE(my_part.unread_count, 0)::integer as unread_count,
    other_p.id as other_user_id,
    other_p.full_name as other_user_name,
    other_p.avatar_url as other_user_avatar,
    COALESCE(other_p.is_online, false) as other_user_online,
    other_p.department_id as other_user_department_id,
    d.name as other_user_department_name,
    d.color as other_user_department_color
  FROM internal_chat_threads t
  INNER JOIN internal_chat_participants my_part ON my_part.thread_id = t.id AND my_part.user_id = p_user_id
  INNER JOIN internal_chat_participants other_part ON other_part.thread_id = t.id AND other_part.user_id != p_user_id
  INNER JOIN profiles other_p ON other_p.id = other_part.user_id
  LEFT JOIN departments d ON d.id = other_p.department_id
  ORDER BY t.last_message_at DESC NULLS LAST;
END;
$$;

-- Create function to get unread count
CREATE OR REPLACE FUNCTION public.get_internal_chat_unread_count(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(unread_count), 0)::integer
  FROM internal_chat_participants
  WHERE user_id = p_user_id;
$$;