-- Remover politica atual (sem WITH CHECK)
DROP POLICY IF EXISTS "Tenant isolation for message_templates" ON public.message_templates;

-- Recriar com WITH CHECK para permitir INSERT/UPDATE
CREATE POLICY "Tenant isolation for message_templates"
ON public.message_templates
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id())
WITH CHECK (tenant_id = get_user_tenant_id());