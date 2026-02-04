-- ============================================
-- FASE 4: AJUSTAR RLS PARA SUPER ADMIN
-- ============================================
-- Execute este script no Supabase SQL Editor
-- Data: ____/____/________
-- Responsável: ________________
--
-- OBJETIVO: Adicionar bypass de RLS para Super Admin
-- Isso permite que o Super Admin veja dados de todos os tenants
-- ============================================

-- 4.1 Garantir que a função current_user_is_super_admin existe
CREATE OR REPLACE FUNCTION public.current_user_is_super_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
  );
END;
$$;

-- 4.2 Atualizar função get_user_tenant_id para suportar Super Admin
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_tenant_id UUID;
  v_is_super_admin BOOLEAN;
BEGIN
  -- Verificar se é Super Admin
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
  ) INTO v_is_super_admin;

  -- Se for Super Admin, pode usar qualquer tenant (definido por sessão ou retorna tenant do profile)
  IF v_is_super_admin THEN
    -- Tentar pegar tenant da sessão (se definido)
    BEGIN
      v_tenant_id := NULLIF(current_setting('app.current_tenant_id', true), '')::UUID;
      IF v_tenant_id IS NOT NULL THEN
        RETURN v_tenant_id;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Ignorar erro se a configuração não existir
      NULL;
    END;
  END IF;

  -- Para usuários normais (ou Super Admin sem tenant de sessão), retorna o tenant do profile
  SELECT tenant_id INTO v_tenant_id
  FROM public.profiles
  WHERE id = auth.uid();

  RETURN v_tenant_id;
END;
$$;

-- ==========================================
-- 4.3 ATUALIZAR POLÍTICAS RLS PARA TABELAS CRÍTICAS
-- ==========================================

-- CONTACTS
DROP POLICY IF EXISTS "Tenant isolation for contacts" ON public.contacts;
DROP POLICY IF EXISTS "super_admin_bypass_contacts" ON public.contacts;
CREATE POLICY "Tenant isolation with super admin bypass for contacts" ON public.contacts
FOR ALL
TO authenticated
USING (
  tenant_id = get_user_tenant_id()
  OR current_user_is_super_admin()
);

-- CONVERSATIONS
DROP POLICY IF EXISTS "Tenant isolation for conversations" ON public.conversations;
DROP POLICY IF EXISTS "super_admin_bypass_conversations" ON public.conversations;
CREATE POLICY "Tenant isolation with super admin bypass for conversations" ON public.conversations
FOR ALL
TO authenticated
USING (
  tenant_id = get_user_tenant_id()
  OR current_user_is_super_admin()
);

-- MESSAGES
DROP POLICY IF EXISTS "Tenant isolation for messages" ON public.messages;
DROP POLICY IF EXISTS "super_admin_bypass_messages" ON public.messages;
CREATE POLICY "Tenant isolation with super admin bypass for messages" ON public.messages
FOR ALL
TO authenticated
USING (
  tenant_id = get_user_tenant_id()
  OR current_user_is_super_admin()
);

-- PROFILES
DROP POLICY IF EXISTS "Tenant isolation for profiles" ON public.profiles;
DROP POLICY IF EXISTS "super_admin_bypass_profiles" ON public.profiles;
CREATE POLICY "Tenant isolation with super admin bypass for profiles" ON public.profiles
FOR ALL
TO authenticated
USING (
  tenant_id = get_user_tenant_id()
  OR current_user_is_super_admin()
  OR id = auth.uid()  -- Usuário sempre pode ver seu próprio perfil
);

-- ORDERS
DROP POLICY IF EXISTS "Tenant isolation for orders" ON public.orders;
DROP POLICY IF EXISTS "super_admin_bypass_orders" ON public.orders;
CREATE POLICY "Tenant isolation with super admin bypass for orders" ON public.orders
FOR ALL
TO authenticated
USING (
  tenant_id = get_user_tenant_id()
  OR current_user_is_super_admin()
);

-- DEALS
DROP POLICY IF EXISTS "Tenant isolation for deals" ON public.deals;
DROP POLICY IF EXISTS "super_admin_bypass_deals" ON public.deals;
CREATE POLICY "Tenant isolation with super admin bypass for deals" ON public.deals
FOR ALL
TO authenticated
USING (
  tenant_id = get_user_tenant_id()
  OR current_user_is_super_admin()
);

-- PRODUCTS
DROP POLICY IF EXISTS "Tenant isolation for products" ON public.products;
DROP POLICY IF EXISTS "super_admin_bypass_products" ON public.products;
CREATE POLICY "Tenant isolation with super admin bypass for products" ON public.products
FOR ALL
TO authenticated
USING (
  tenant_id = get_user_tenant_id()
  OR current_user_is_super_admin()
);

-- FINANCIAL_TRANSACTIONS
DROP POLICY IF EXISTS "Tenant isolation for financial_transactions" ON public.financial_transactions;
DROP POLICY IF EXISTS "super_admin_bypass_financial_transactions" ON public.financial_transactions;
CREATE POLICY "Tenant isolation with super admin bypass for financial_transactions" ON public.financial_transactions
FOR ALL
TO authenticated
USING (
  tenant_id = get_user_tenant_id()
  OR current_user_is_super_admin()
);

-- DEPARTMENTS
DROP POLICY IF EXISTS "Tenant isolation for departments" ON public.departments;
DROP POLICY IF EXISTS "super_admin_bypass_departments" ON public.departments;
CREATE POLICY "Tenant isolation with super admin bypass for departments" ON public.departments
FOR ALL
TO authenticated
USING (
  tenant_id = get_user_tenant_id()
  OR current_user_is_super_admin()
);

-- MENU_ITEMS
DROP POLICY IF EXISTS "Tenant isolation for menu_items" ON public.menu_items;
DROP POLICY IF EXISTS "super_admin_bypass_menu_items" ON public.menu_items;
CREATE POLICY "Tenant isolation with super admin bypass for menu_items" ON public.menu_items
FOR ALL
TO authenticated
USING (
  tenant_id = get_user_tenant_id()
  OR current_user_is_super_admin()
);

-- TAGS
DROP POLICY IF EXISTS "Tenant isolation for tags" ON public.tags;
DROP POLICY IF EXISTS "super_admin_bypass_tags" ON public.tags;
CREATE POLICY "Tenant isolation with super admin bypass for tags" ON public.tags
FOR ALL
TO authenticated
USING (
  tenant_id = get_user_tenant_id()
  OR current_user_is_super_admin()
);

-- PIPELINES
DROP POLICY IF EXISTS "Tenant isolation for pipelines" ON public.pipelines;
DROP POLICY IF EXISTS "super_admin_bypass_pipelines" ON public.pipelines;
CREATE POLICY "Tenant isolation with super admin bypass for pipelines" ON public.pipelines
FOR ALL
TO authenticated
USING (
  tenant_id = get_user_tenant_id()
  OR current_user_is_super_admin()
);

-- CHATBOT_FLOWS
DROP POLICY IF EXISTS "Tenant isolation for chatbot_flows" ON public.chatbot_flows;
DROP POLICY IF EXISTS "super_admin_bypass_chatbot_flows" ON public.chatbot_flows;
CREATE POLICY "Tenant isolation with super admin bypass for chatbot_flows" ON public.chatbot_flows
FOR ALL
TO authenticated
USING (
  tenant_id = get_user_tenant_id()
  OR current_user_is_super_admin()
);

-- WHATSAPP_CHANNELS
DROP POLICY IF EXISTS "Tenant isolation for whatsapp_channels" ON public.whatsapp_channels;
DROP POLICY IF EXISTS "super_admin_bypass_whatsapp_channels" ON public.whatsapp_channels;
CREATE POLICY "Tenant isolation with super admin bypass for whatsapp_channels" ON public.whatsapp_channels
FOR ALL
TO authenticated
USING (
  tenant_id = get_user_tenant_id()
  OR current_user_is_super_admin()
);

-- COMPANY_SETTINGS
DROP POLICY IF EXISTS "Tenant isolation for company_settings" ON public.company_settings;
DROP POLICY IF EXISTS "super_admin_bypass_company_settings" ON public.company_settings;
CREATE POLICY "Tenant isolation with super admin bypass for company_settings" ON public.company_settings
FOR ALL
TO authenticated
USING (
  tenant_id = get_user_tenant_id()
  OR current_user_is_super_admin()
);

-- ==========================================
-- 4.4 VERIFICAÇÃO
-- ==========================================

-- Verificar políticas criadas
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles::text,
  cmd
FROM pg_policies
WHERE policyname LIKE '%super admin%'
ORDER BY tablename;

-- Verificar Super Admins existentes
SELECT
  p.full_name,
  p.email,
  ur.role,
  t.name as tenant_name
FROM user_roles ur
JOIN profiles p ON p.id = ur.user_id
LEFT JOIN tenants t ON t.id = p.tenant_id
WHERE ur.role = 'super_admin';

-- ============================================
-- FIM DA FASE 4
-- ============================================
