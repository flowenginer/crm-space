-- Add special access columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS can_view_all_conversations BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS can_transfer_freely BOOLEAN DEFAULT FALSE;

-- Add special access columns to departments table
ALTER TABLE public.departments 
ADD COLUMN IF NOT EXISTS can_view_all_conversations BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS can_transfer_freely BOOLEAN DEFAULT FALSE;

-- Update can_view_all_data function to check new flags
CREATE OR REPLACE FUNCTION public.can_view_all_data(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_role text;
  user_flag boolean;
  dept_flag boolean;
BEGIN
  -- 1. Check role (admin/supervisor)
  SELECT role, can_view_all_conversations 
  INTO user_role, user_flag 
  FROM profiles WHERE id = _user_id;
  
  IF user_role IN ('admin', 'supervisor') THEN
    RETURN TRUE;
  END IF;
  
  -- 2. Check user's individual flag
  IF user_flag = TRUE THEN
    RETURN TRUE;
  END IF;
  
  -- 3. Check user's departments
  SELECT EXISTS (
    SELECT 1 FROM user_departments ud
    INNER JOIN departments d ON d.id = ud.department_id
    WHERE ud.user_id = _user_id 
    AND d.can_view_all_conversations = TRUE
  ) INTO dept_flag;
  
  RETURN COALESCE(dept_flag, FALSE);
END;
$function$;

-- Create can_transfer_freely function
CREATE OR REPLACE FUNCTION public.can_transfer_freely(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_role text;
  user_flag boolean;
  dept_flag boolean;
BEGIN
  -- Admin/Supervisor can always transfer
  SELECT role, can_transfer_freely 
  INTO user_role, user_flag 
  FROM profiles WHERE id = _user_id;
  
  IF user_role IN ('admin', 'supervisor') THEN
    RETURN TRUE;
  END IF;
  
  -- Check user's individual flag
  IF user_flag = TRUE THEN
    RETURN TRUE;
  END IF;
  
  -- Check user's departments
  SELECT EXISTS (
    SELECT 1 FROM user_departments ud
    INNER JOIN departments d ON d.id = ud.department_id
    WHERE ud.user_id = _user_id 
    AND d.can_transfer_freely = TRUE
  ) INTO dept_flag;
  
  RETURN COALESCE(dept_flag, FALSE);
END;
$function$;