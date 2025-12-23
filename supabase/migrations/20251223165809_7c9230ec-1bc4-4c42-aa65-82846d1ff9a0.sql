-- =====================================================
-- FASE 5: HARDENING DE DADOS SENSÍVEIS
-- =====================================================

-- 1. META_AD_ACCOUNTS: Proteger tokens OAuth
-- Criar uma view segura que NÃO expõe os tokens
CREATE OR REPLACE VIEW public.meta_ad_accounts_safe AS
SELECT 
  id,
  user_id,
  account_id,
  account_name,
  business_id,
  currency,
  timezone,
  is_active,
  last_sync_at,
  created_at,
  updated_at,
  tenant_id,
  -- Tokens são ocultados - apenas indicamos se existem
  CASE WHEN access_token IS NOT NULL THEN true ELSE false END as has_access_token,
  CASE WHEN refresh_token IS NOT NULL THEN true ELSE false END as has_refresh_token,
  token_expires_at
FROM public.meta_ad_accounts
WHERE tenant_id = get_user_tenant_id();

-- Revogar SELECT direto na tabela para usuários anon/authenticated
-- Apenas funções de backend (service_role) devem acessar tokens diretamente
REVOKE SELECT ON public.meta_ad_accounts FROM anon, authenticated;

-- Dar SELECT na view segura
GRANT SELECT ON public.meta_ad_accounts_safe TO authenticated;

-- Manter INSERT/UPDATE/DELETE na tabela original (controlado por RLS)
GRANT INSERT, UPDATE, DELETE ON public.meta_ad_accounts TO authenticated;

-- 2. STORES: Garantir isolamento por tenant
-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view their tenant stores" ON stores;
DROP POLICY IF EXISTS "Users can insert their tenant stores" ON stores;
DROP POLICY IF EXISTS "Users can update their tenant stores" ON stores;
DROP POLICY IF EXISTS "Users can delete their tenant stores" ON stores;
DROP POLICY IF EXISTS "Stores are viewable by tenant users" ON stores;
DROP POLICY IF EXISTS "Stores can be inserted by tenant admins" ON stores;
DROP POLICY IF EXISTS "Stores can be updated by tenant admins" ON stores;
DROP POLICY IF EXISTS "Stores can be deleted by tenant admins" ON stores;

-- Criar políticas mais restritivas
CREATE POLICY "stores_select_tenant_only"
  ON stores FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "stores_insert_tenant_admin"
  ON stores FOR INSERT
  WITH CHECK (
    tenant_id = get_user_tenant_id() 
    AND is_admin(auth.uid())
  );

CREATE POLICY "stores_update_tenant_admin"
  ON stores FOR UPDATE
  USING (
    tenant_id = get_user_tenant_id() 
    AND is_admin(auth.uid())
  );

CREATE POLICY "stores_delete_tenant_admin"
  ON stores FOR DELETE
  USING (
    tenant_id = get_user_tenant_id() 
    AND is_admin(auth.uid())
  );

-- 3. CONTACTS: Adicionar função para mascarar dados sensíveis
CREATE OR REPLACE FUNCTION public.mask_cpf_cnpj(p_cpf_cnpj TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_cpf_cnpj IS NULL OR length(p_cpf_cnpj) < 4 THEN
    RETURN p_cpf_cnpj;
  END IF;
  -- Mostra apenas os últimos 4 dígitos
  RETURN repeat('*', length(p_cpf_cnpj) - 4) || right(p_cpf_cnpj, 4);
END;
$$;

-- View segura para contatos com dados mascarados para usuários não-admin
CREATE OR REPLACE VIEW public.contacts_safe AS
SELECT 
  id,
  full_name,
  phone,
  email,
  avatar_url,
  -- Dados sensíveis mascarados para não-admin
  CASE 
    WHEN is_admin(auth.uid()) OR assigned_to = auth.uid() THEN cpf_cnpj 
    ELSE mask_cpf_cnpj(cpf_cnpj)
  END as cpf_cnpj,
  CASE 
    WHEN is_admin(auth.uid()) OR assigned_to = auth.uid() THEN birth_date 
    ELSE NULL
  END as birth_date,
  -- Endereço parcial para não-admin
  CASE 
    WHEN is_admin(auth.uid()) OR assigned_to = auth.uid() THEN street 
    ELSE NULL
  END as street,
  CASE 
    WHEN is_admin(auth.uid()) OR assigned_to = auth.uid() THEN number 
    ELSE NULL
  END as number,
  city,
  state,
  country,
  zip_code,
  -- Campos de negócio sempre visíveis
  contact_type,
  person_type,
  lead_status,
  lead_score,
  negotiated_value,
  origin,
  origin_campaign,
  segment_id,
  department_id,
  assigned_to,
  notes,
  custom_fields,
  is_blocked,
  blocked_reason,
  is_online,
  is_typing,
  last_seen_at,
  first_contact_at,
  last_interaction_at,
  created_at,
  updated_at,
  tenant_id
FROM public.contacts
WHERE tenant_id = get_user_tenant_id();

-- Grant na view segura
GRANT SELECT ON public.contacts_safe TO authenticated;

-- 4. Criar função segura para obter tokens (apenas para uso interno/edge functions)
CREATE OR REPLACE FUNCTION public.get_meta_account_tokens(p_account_id UUID)
RETURNS TABLE (
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID := get_user_tenant_id();
  v_user_id UUID := auth.uid();
BEGIN
  -- Verificar se o usuário é admin ou dono da conta
  IF NOT EXISTS (
    SELECT 1 FROM meta_ad_accounts 
    WHERE id = p_account_id 
    AND tenant_id = v_tenant_id
    AND (user_id = v_user_id OR is_admin(v_user_id))
  ) THEN
    RAISE EXCEPTION 'Acesso negado aos tokens desta conta';
  END IF;

  RETURN QUERY
  SELECT 
    m.access_token,
    m.refresh_token,
    m.token_expires_at
  FROM meta_ad_accounts m
  WHERE m.id = p_account_id
  AND m.tenant_id = v_tenant_id;
END;
$$;

-- 5. Atualizar política de meta_ad_accounts para INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "Users can manage their own meta accounts" ON meta_ad_accounts;
DROP POLICY IF EXISTS "meta_ad_accounts_select_policy" ON meta_ad_accounts;
DROP POLICY IF EXISTS "meta_ad_accounts_insert_policy" ON meta_ad_accounts;
DROP POLICY IF EXISTS "meta_ad_accounts_update_policy" ON meta_ad_accounts;
DROP POLICY IF EXISTS "meta_ad_accounts_delete_policy" ON meta_ad_accounts;

-- Políticas apenas para INSERT/UPDATE/DELETE (SELECT foi revogado)
CREATE POLICY "meta_ad_accounts_insert_policy"
  ON meta_ad_accounts FOR INSERT
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND (user_id = auth.uid() OR is_admin(auth.uid()))
  );

CREATE POLICY "meta_ad_accounts_update_policy"
  ON meta_ad_accounts FOR UPDATE
  USING (
    tenant_id = get_user_tenant_id()
    AND (user_id = auth.uid() OR is_admin(auth.uid()))
  );

CREATE POLICY "meta_ad_accounts_delete_policy"
  ON meta_ad_accounts FOR DELETE
  USING (
    tenant_id = get_user_tenant_id()
    AND (user_id = auth.uid() OR is_admin(auth.uid()))
  );