-- Fix multi-tenant RLS for departments and profiles

-- 1. Remove DEFAULT values from tenant_id columns
ALTER TABLE departments ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE profiles ALTER COLUMN tenant_id DROP DEFAULT;

-- 2. Update RLS policies to allow NULL in WITH CHECK

-- departments
DROP POLICY IF EXISTS "Tenant isolation for departments" ON departments;
CREATE POLICY "Tenant isolation for departments" ON departments
AS RESTRICTIVE FOR ALL TO authenticated
USING (tenant_id = get_user_tenant_id())
WITH CHECK (tenant_id IS NULL OR tenant_id = get_user_tenant_id());

-- profiles
DROP POLICY IF EXISTS "Tenant isolation for profiles" ON profiles;
CREATE POLICY "Tenant isolation for profiles" ON profiles
AS RESTRICTIVE FOR ALL TO authenticated
USING (tenant_id = get_user_tenant_id())
WITH CHECK (tenant_id IS NULL OR tenant_id = get_user_tenant_id());