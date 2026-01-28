-- =================================================================
-- Fix: Tenant Isolation for Contacts Creation
-- Issue: DEFAULT value on tenant_id column causes RLS policy failure
-- for non-master tenants because DEFAULT is applied BEFORE RLS check
-- =================================================================

-- 1. Remove the problematic DEFAULT from contacts table
ALTER TABLE contacts 
ALTER COLUMN tenant_id DROP DEFAULT;

-- 2. Update the RESTRICTIVE RLS policy to allow NULL during INSERT
-- The trigger set_tenant_id_from_user will fill the correct value
DROP POLICY IF EXISTS "Tenant isolation for contacts" ON contacts;

CREATE POLICY "Tenant isolation for contacts" ON contacts
AS RESTRICTIVE FOR ALL TO authenticated
USING (tenant_id = get_user_tenant_id())
WITH CHECK (
  -- For INSERT: accept NULL (trigger will fill) OR correct tenant_id
  tenant_id IS NULL OR tenant_id = get_user_tenant_id()
);