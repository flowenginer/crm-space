-- Fix messages table RLS for multi-tenant support
-- Remove hardcoded master tenant DEFAULT
ALTER TABLE messages ALTER COLUMN tenant_id DROP DEFAULT;

-- Update RLS policy to allow NULL on INSERT (trigger will set correct tenant_id)
DROP POLICY IF EXISTS "Tenant isolation for messages" ON messages;
CREATE POLICY "Tenant isolation for messages" ON messages
AS RESTRICTIVE FOR ALL TO authenticated
USING (tenant_id = get_user_tenant_id())
WITH CHECK (tenant_id IS NULL OR tenant_id = get_user_tenant_id());