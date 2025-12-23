-- Drop and recreate get_all_tenants_with_stats with proper types
DROP FUNCTION IF EXISTS public.get_all_tenants_with_stats();

CREATE OR REPLACE FUNCTION public.get_all_tenants_with_stats()
RETURNS TABLE(
  id uuid,
  name text,
  slug text,
  is_active boolean,
  plan_type text,
  created_at timestamptz,
  user_count bigint,
  contact_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if current user is super admin
  IF NOT current_user_is_super_admin() THEN
    RAISE EXCEPTION 'Access denied: Super admin privileges required';
  END IF;

  RETURN QUERY
  SELECT 
    t.id,
    t.name::text,
    t.slug::text,
    t.is_active,
    t.plan_type::text,
    t.created_at,
    COALESCE((SELECT COUNT(*) FROM profiles p WHERE p.tenant_id = t.id), 0) as user_count,
    COALESCE((SELECT COUNT(*) FROM contacts c WHERE c.tenant_id = t.id), 0) as contact_count
  FROM tenants t
  ORDER BY t.created_at DESC;
END;
$$;