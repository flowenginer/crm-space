-- Remover políticas antigas conflitantes
DROP POLICY IF EXISTS "Users can view own meta accounts" ON meta_ad_accounts;
DROP POLICY IF EXISTS "Users can update own meta accounts" ON meta_ad_accounts;
DROP POLICY IF EXISTS "Users can delete own meta accounts" ON meta_ad_accounts;
DROP POLICY IF EXISTS "Users can insert own meta accounts" ON meta_ad_accounts;
DROP POLICY IF EXISTS "Tenant isolation for meta_ad_accounts" ON meta_ad_accounts;
DROP POLICY IF EXISTS "meta_ad_accounts_delete_policy" ON meta_ad_accounts;
DROP POLICY IF EXISTS "meta_ad_accounts_insert_policy" ON meta_ad_accounts;
DROP POLICY IF EXISTS "meta_ad_accounts_update_policy" ON meta_ad_accounts;

-- Criar políticas corretas para authenticated
CREATE POLICY "meta_ad_accounts_select" ON meta_ad_accounts
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id() 
    AND (user_id = auth.uid() OR is_admin(auth.uid()))
  );

CREATE POLICY "meta_ad_accounts_insert" ON meta_ad_accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = get_user_tenant_id() 
    AND user_id = auth.uid()
  );

CREATE POLICY "meta_ad_accounts_update" ON meta_ad_accounts
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id() 
    AND (user_id = auth.uid() OR is_admin(auth.uid()))
  );

CREATE POLICY "meta_ad_accounts_delete" ON meta_ad_accounts
  FOR DELETE
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id() 
    AND (user_id = auth.uid() OR is_admin(auth.uid()))
  );