-- Ensure RLS is enabled
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;

-- Helper: resolve current user's tenant_id safely
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

-- Policies
DROP POLICY IF EXISTS "marketing_campaigns_select_own_tenant" ON public.marketing_campaigns;
CREATE POLICY "marketing_campaigns_select_own_tenant"
ON public.marketing_campaigns
FOR SELECT
USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "marketing_campaigns_insert_own_tenant" ON public.marketing_campaigns;
CREATE POLICY "marketing_campaigns_insert_own_tenant"
ON public.marketing_campaigns
FOR INSERT
WITH CHECK (
  tenant_id = public.current_tenant_id()
  AND created_by = auth.uid()
);

DROP POLICY IF EXISTS "marketing_campaigns_update_own_tenant" ON public.marketing_campaigns;
CREATE POLICY "marketing_campaigns_update_own_tenant"
ON public.marketing_campaigns
FOR UPDATE
USING (tenant_id = public.current_tenant_id())
WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "marketing_campaigns_delete_own_tenant" ON public.marketing_campaigns;
CREATE POLICY "marketing_campaigns_delete_own_tenant"
ON public.marketing_campaigns
FOR DELETE
USING (tenant_id = public.current_tenant_id());

-- Ensure function isn't publicly writable
REVOKE ALL ON FUNCTION public.current_tenant_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO anon, authenticated;