-- =============================================
-- FASE 1B: Estrutura de Super Admin
-- =============================================

-- 1. Criar tabela tenant_admins para controle de admins por tenant
CREATE TABLE IF NOT EXISTS public.tenant_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  is_owner boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, tenant_id)
);

-- 2. Habilitar RLS na tabela tenant_admins
ALTER TABLE public.tenant_admins ENABLE ROW LEVEL SECURITY;

-- 3. Criar função is_super_admin() - SECURITY DEFINER para evitar recursão RLS
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _user_id AND role = 'super_admin'
  )
$$;

-- 4. Criar função is_tenant_owner() para verificar se é dono do tenant
CREATE OR REPLACE FUNCTION public.is_tenant_owner(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_admins 
    WHERE user_id = _user_id AND is_owner = true
  )
$$;

-- 5. Criar função can_manage_tenant() para verificar se pode gerenciar um tenant específico
CREATE OR REPLACE FUNCTION public.can_manage_tenant(_tenant_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    public.is_super_admin(_user_id) -- Super admin gerencia qualquer tenant
    OR EXISTS (
      SELECT 1 FROM public.tenant_admins 
      WHERE user_id = _user_id 
      AND tenant_id = _tenant_id 
      AND is_owner = true
    )
$$;

-- 6. Políticas RLS para tenant_admins
CREATE POLICY "Super admins can manage all tenant_admins"
ON public.tenant_admins
FOR ALL
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Tenant owners can view their tenant admins"
ON public.tenant_admins
FOR SELECT
USING (
  tenant_id = public.get_user_tenant_id()
  AND public.is_tenant_owner(auth.uid())
);

-- 7. Inserir role_definition para Super Admin
INSERT INTO public.role_definitions (
  role_key,
  role_name,
  description,
  color,
  icon,
  is_system,
  order_position,
  permissions
) VALUES (
  'super_admin',
  'Super Administrador',
  'Acesso total cross-tenant. Gerencia todos os tenants, usuários e configurações globais do sistema.',
  '#DC2626',
  'ShieldCheck',
  true,
  0,
  jsonb_build_object(
    'tenants', jsonb_build_object(
      'view', true,
      'create', true,
      'update', true,
      'delete', true,
      'manage_users', true,
      'manage_billing', true,
      'switch_tenant', true
    ),
    'users', jsonb_build_object(
      'view', true,
      'view_all_tenants', true,
      'create', true,
      'update', true,
      'delete', true,
      'manage_roles', true,
      'assign_to_tenant', true
    ),
    'system', jsonb_build_object(
      'view_logs', true,
      'manage_integrations', true,
      'manage_global_settings', true,
      'impersonate_users', true
    ),
    'automations', jsonb_build_object('view', true, 'create', true, 'update', true, 'delete', true, 'publish', true),
    'channels', jsonb_build_object('view', true, 'create', true, 'update', true, 'delete', true, 'connect', true),
    'contacts', jsonb_build_object('view', true, 'create', true, 'update', true, 'delete', true, 'import', true, 'export', true),
    'conversations', jsonb_build_object('view', true, 'view_all', true, 'view_unassigned', true, 'create', true, 'respond', true, 'close', true, 'transfer', true, 'requests', true),
    'dashboard', jsonb_build_object('view', true, 'view_all', true),
    'deals', jsonb_build_object('view', true, 'view_all', true, 'create', true, 'update', true, 'delete', true),
    'live', jsonb_build_object('view', true, 'intervene', true),
    'marketing', jsonb_build_object('view', true, 'view_campaigns', true, 'manage', true),
    'queues', jsonb_build_object('view', true, 'manage', true, 'manage_agents', true),
    'reports', jsonb_build_object('view', true, 'view_all', true, 'export', true),
    'schedules', jsonb_build_object('view', true, 'create', true, 'update', true, 'delete', true),
    'settings', jsonb_build_object('view', true, 'update', true, 'users', true, 'departments', true, 'tags', true, 'channels', true, 'fields', true, 'integrations', true, 'close_reasons', true),
    'tags', jsonb_build_object('view', true, 'create', true, 'update', true, 'delete', true),
    'templates', jsonb_build_object('view', true, 'create', true, 'update', true, 'delete', true),
    'webhooks', jsonb_build_object('view', true, 'create', true, 'update', true, 'delete', true)
  )
) ON CONFLICT (role_key) DO UPDATE SET
  role_name = EXCLUDED.role_name,
  description = EXCLUDED.description,
  color = EXCLUDED.color,
  icon = EXCLUDED.icon,
  order_position = EXCLUDED.order_position,
  permissions = EXCLUDED.permissions;

-- 8. Inserir permission_definitions para categorias de Super Admin
INSERT INTO public.permission_definitions (category, permission_key, permission_name, description) VALUES
  ('tenants', 'tenants.view', 'Ver Tenants', 'Visualizar lista de empresas/tenants'),
  ('tenants', 'tenants.create', 'Criar Tenant', 'Criar novas empresas/tenants'),
  ('tenants', 'tenants.update', 'Editar Tenant', 'Modificar configurações de tenants'),
  ('tenants', 'tenants.delete', 'Excluir Tenant', 'Remover tenants do sistema'),
  ('tenants', 'tenants.manage_users', 'Gerenciar Usuários do Tenant', 'Adicionar/remover usuários de tenants'),
  ('tenants', 'tenants.switch_tenant', 'Trocar de Tenant', 'Alternar entre diferentes tenants'),
  ('system', 'system.view_logs', 'Ver Logs do Sistema', 'Acessar logs globais do sistema'),
  ('system', 'system.manage_global_settings', 'Configurações Globais', 'Gerenciar configurações globais'),
  ('system', 'system.impersonate_users', 'Personificar Usuários', 'Acessar como outro usuário para suporte')
ON CONFLICT (permission_key) DO NOTHING;

-- 9. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_tenant_admins_user_id ON public.tenant_admins(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_admins_tenant_id ON public.tenant_admins(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_super_admin ON public.user_roles(user_id) WHERE role = 'super_admin';

-- 10. Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_tenant_admins_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS update_tenant_admins_updated_at ON public.tenant_admins;
CREATE TRIGGER update_tenant_admins_updated_at
  BEFORE UPDATE ON public.tenant_admins
  FOR EACH ROW
  EXECUTE FUNCTION public.update_tenant_admins_updated_at();