-- Fix RLS policies for active_marketing_campaigns table
-- Drop existing policies that use JWT claims (which don't contain tenant_id)
DROP POLICY IF EXISTS "Users can view active marketing campaigns from their tenant" ON active_marketing_campaigns;
DROP POLICY IF EXISTS "Users can update active marketing campaigns in their tenant" ON active_marketing_campaigns;
DROP POLICY IF EXISTS "Users can delete active marketing campaigns in their tenant" ON active_marketing_campaigns;

-- Create new policies using get_user_tenant_id() function
CREATE POLICY "Select active_marketing_campaigns by tenant"
ON active_marketing_campaigns FOR SELECT
TO authenticated
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Update active_marketing_campaigns by tenant"
ON active_marketing_campaigns FOR UPDATE
TO authenticated
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Delete active_marketing_campaigns by tenant"
ON active_marketing_campaigns FOR DELETE
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- Fix RLS policies for marketing_scheduled_messages table
DROP POLICY IF EXISTS "Users can view scheduled messages from their tenant" ON marketing_scheduled_messages;
DROP POLICY IF EXISTS "Users can update scheduled messages in their tenant" ON marketing_scheduled_messages;
DROP POLICY IF EXISTS "Users can delete scheduled messages in their tenant" ON marketing_scheduled_messages;

-- Create new policies using get_user_tenant_id() function
CREATE POLICY "Select marketing_scheduled_messages by tenant"
ON marketing_scheduled_messages FOR SELECT
TO authenticated
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Update marketing_scheduled_messages by tenant"
ON marketing_scheduled_messages FOR UPDATE
TO authenticated
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Delete marketing_scheduled_messages by tenant"
ON marketing_scheduled_messages FOR DELETE
TO authenticated
USING (tenant_id = get_user_tenant_id());