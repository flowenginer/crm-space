-- =============================================
-- SISTEMA DE PERFIS E PERMISSÕES
-- =============================================

-- 1. Atualizar tabela profiles com novos campos
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'vendedor' 
  CHECK (role IN ('admin', 'supervisor', 'vendedor', 'designer'));

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES public.profiles(id);

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0;

-- 2. Criar tabela de definição de perfis/roles
CREATE TABLE IF NOT EXISTS public.role_definitions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  role_key TEXT NOT NULL UNIQUE,
  role_name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#8B5CF6',
  icon TEXT DEFAULT 'User',
  permissions JSONB DEFAULT '{}'::jsonb,
  order_position INTEGER DEFAULT 0,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Criar tabela de permissões granulares
CREATE TABLE IF NOT EXISTS public.permission_definitions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  permission_key TEXT NOT NULL UNIQUE,
  permission_name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Criar tabela de convites pendentes
CREATE TABLE IF NOT EXISTS public.user_invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'vendedor',
  department_id UUID REFERENCES public.departments(id),
  invited_by UUID REFERENCES public.profiles(id) NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES public.profiles(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Habilitar RLS
ALTER TABLE public.role_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_invites ENABLE ROW LEVEL SECURITY;

-- 6. Criar políticas RLS
CREATE POLICY "authenticated_read_role_definitions" ON public.role_definitions FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated_read_permission_definitions" ON public.permission_definitions FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated_access_user_invites" ON public.user_invites FOR ALL USING (auth.uid() IS NOT NULL);

-- 7. Criar índices
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON public.profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_invites_email ON public.user_invites(email);
CREATE INDEX IF NOT EXISTS idx_invites_token ON public.user_invites(token);
CREATE INDEX IF NOT EXISTS idx_invites_status ON public.user_invites(status);

-- 8. Inserir definições de perfis padrão
INSERT INTO public.role_definitions (role_key, role_name, description, color, icon, order_position, is_system, permissions) VALUES
(
  'admin',
  'Administrador',
  'Acesso total ao sistema. Pode gerenciar usuários, configurações e todos os módulos.',
  '#EF4444',
  'Shield',
  1,
  true,
  '{"users": {"create": true, "read": true, "update": true, "delete": true}, "contacts": {"create": true, "read": true, "update": true, "delete": true, "import": true, "export": true}, "conversations": {"create": true, "read": true, "update": true, "delete": true, "transfer": true, "close": true, "view_all": true}, "deals": {"create": true, "read": true, "update": true, "delete": true, "view_all": true}, "templates": {"create": true, "read": true, "update": true, "delete": true}, "channels": {"create": true, "read": true, "update": true, "delete": true, "connect": true}, "reports": {"view": true, "export": true, "view_all": true}, "settings": {"view": true, "update": true}, "tags": {"create": true, "read": true, "update": true, "delete": true}, "queues": {"create": true, "read": true, "update": true, "delete": true, "manage_agents": true}}'::jsonb
),
(
  'supervisor',
  'Supervisor',
  'Gerencia equipe do departamento. Vê relatórios e pode transferir atendimentos.',
  '#F59E0B',
  'UserCog',
  2,
  true,
  '{"users": {"create": false, "read": true, "update": false, "delete": false}, "contacts": {"create": true, "read": true, "update": true, "delete": false, "import": true, "export": true}, "conversations": {"create": true, "read": true, "update": true, "delete": false, "transfer": true, "close": true, "view_all": true}, "deals": {"create": true, "read": true, "update": true, "delete": false, "view_all": true}, "templates": {"create": true, "read": true, "update": true, "delete": false}, "channels": {"create": false, "read": true, "update": false, "delete": false, "connect": false}, "reports": {"view": true, "export": true, "view_all": true}, "settings": {"view": true, "update": false}, "tags": {"create": true, "read": true, "update": true, "delete": false}, "queues": {"create": false, "read": true, "update": false, "delete": false, "manage_agents": true}}'::jsonb
),
(
  'vendedor',
  'Vendedor',
  'Atende clientes, cria orçamentos e acompanha negociações.',
  '#10B981',
  'ShoppingCart',
  3,
  true,
  '{"users": {"create": false, "read": false, "update": false, "delete": false}, "contacts": {"create": true, "read": true, "update": true, "delete": false, "import": false, "export": false}, "conversations": {"create": true, "read": true, "update": true, "delete": false, "transfer": true, "close": true, "view_all": false}, "deals": {"create": true, "read": true, "update": true, "delete": false, "view_all": false}, "templates": {"create": false, "read": true, "update": false, "delete": false}, "channels": {"create": false, "read": true, "update": false, "delete": false, "connect": false}, "reports": {"view": true, "export": false, "view_all": false}, "settings": {"view": false, "update": false}, "tags": {"create": false, "read": true, "update": false, "delete": false}, "queues": {"create": false, "read": true, "update": false, "delete": false, "manage_agents": false}}'::jsonb
),
(
  'designer',
  'Designer',
  'Acessa área de produção, layouts e artes. Não atende clientes diretamente.',
  '#8B5CF6',
  'Palette',
  4,
  true,
  '{"users": {"create": false, "read": false, "update": false, "delete": false}, "contacts": {"create": false, "read": true, "update": false, "delete": false, "import": false, "export": false}, "conversations": {"create": false, "read": true, "update": false, "delete": false, "transfer": false, "close": false, "view_all": false}, "deals": {"create": false, "read": true, "update": true, "delete": false, "view_all": false}, "templates": {"create": true, "read": true, "update": true, "delete": false}, "channels": {"create": false, "read": false, "update": false, "delete": false, "connect": false}, "reports": {"view": false, "export": false, "view_all": false}, "settings": {"view": false, "update": false}, "tags": {"create": false, "read": true, "update": false, "delete": false}, "queues": {"create": false, "read": false, "update": false, "delete": false, "manage_agents": false}}'::jsonb
)
ON CONFLICT (role_key) DO NOTHING;

-- 9. Função para verificar permissão
CREATE OR REPLACE FUNCTION public.check_user_permission(user_id UUID, permission_key TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
  role_permissions JSONB;
  permission_parts TEXT[];
  category TEXT;
  action TEXT;
BEGIN
  SELECT role INTO user_role FROM public.profiles WHERE id = user_id;
  
  IF user_role IS NULL THEN
    RETURN FALSE;
  END IF;
  
  IF user_role = 'admin' THEN
    RETURN TRUE;
  END IF;
  
  SELECT permissions INTO role_permissions 
  FROM public.role_definitions 
  WHERE role_key = user_role;
  
  permission_parts := string_to_array(permission_key, '.');
  category := permission_parts[1];
  action := permission_parts[2];
  
  RETURN COALESCE((role_permissions->category->>action)::boolean, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;