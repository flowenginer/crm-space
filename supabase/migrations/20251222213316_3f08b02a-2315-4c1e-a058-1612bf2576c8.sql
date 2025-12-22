-- Create app_role enum if not exists
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'supervisor', 'agent');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create user_roles table for proper role management (if not exists)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Function to check if user has a specific role (SECURITY DEFINER to avoid recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to check if current user is super_admin (no params version)
CREATE OR REPLACE FUNCTION public.current_user_is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'super_admin'
  )
$$;

-- RLS policies for user_roles
DROP POLICY IF EXISTS "Super admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

CREATE POLICY "Super admins can manage all roles"
  ON public.user_roles
  FOR ALL
  USING (public.current_user_is_super_admin());

CREATE POLICY "Users can view their own roles"
  ON public.user_roles
  FOR SELECT
  USING (user_id = auth.uid());

-- Policy for super_admin to view all tenants
DROP POLICY IF EXISTS "Super admins can view all tenants" ON public.tenants;
DROP POLICY IF EXISTS "Super admins can update all tenants" ON public.tenants;

CREATE POLICY "Super admins can view all tenants"
  ON public.tenants
  FOR SELECT
  USING (public.current_user_is_super_admin() OR id = get_user_tenant_id());

CREATE POLICY "Super admins can update all tenants"
  ON public.tenants
  FOR UPDATE
  USING (public.current_user_is_super_admin());

-- Function to get tenant stats for super admin
CREATE OR REPLACE FUNCTION public.get_all_tenants_with_stats()
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  plan_type TEXT,
  max_users INTEGER,
  max_contacts INTEGER,
  is_active BOOLEAN,
  trial_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  user_count BIGINT,
  contact_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only super_admin can call this
  IF NOT public.current_user_is_super_admin() THEN
    RAISE EXCEPTION 'Access denied: Super Admin only';
  END IF;
  
  RETURN QUERY
  SELECT 
    t.id,
    t.name,
    t.slug,
    t.plan_type,
    t.max_users,
    t.max_contacts,
    t.is_active,
    t.trial_ends_at,
    t.created_at,
    (SELECT COUNT(*) FROM profiles p WHERE p.tenant_id = t.id) as user_count,
    (SELECT COUNT(*) FROM contacts c WHERE c.tenant_id = t.id) as contact_count
  FROM tenants t
  ORDER BY t.created_at DESC;
END;
$$;

-- Function to update tenant by super admin
CREATE OR REPLACE FUNCTION public.update_tenant_by_super_admin(
  p_tenant_id UUID,
  p_name TEXT DEFAULT NULL,
  p_plan_type TEXT DEFAULT NULL,
  p_max_users INTEGER DEFAULT NULL,
  p_max_contacts INTEGER DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT NULL,
  p_trial_ends_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only super_admin can call this
  IF NOT public.current_user_is_super_admin() THEN
    RAISE EXCEPTION 'Access denied: Super Admin only';
  END IF;
  
  UPDATE tenants
  SET 
    name = COALESCE(p_name, name),
    plan_type = COALESCE(p_plan_type, plan_type),
    max_users = COALESCE(p_max_users, max_users),
    max_contacts = COALESCE(p_max_contacts, max_contacts),
    is_active = COALESCE(p_is_active, is_active),
    trial_ends_at = COALESCE(p_trial_ends_at, trial_ends_at),
    updated_at = now()
  WHERE id = p_tenant_id;
  
  RETURN FOUND;
END;
$$;