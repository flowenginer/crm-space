-- Atualizar RICARDO GRION para Super Admin (MASTER)
UPDATE public.user_roles 
SET role = 'super_admin'
WHERE user_id = 'f484f896-7b12-4477-b836-8c6a17291987';

-- Criar função para verificar se o usuário é o MASTER
CREATE OR REPLACE FUNCTION public.is_master(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id = 'f484f896-7b12-4477-b836-8c6a17291987'::uuid
$$;

-- Criar função para listar todos os super admins
CREATE OR REPLACE FUNCTION public.get_all_super_admins()
RETURNS TABLE(
  user_id uuid,
  full_name text,
  tenant_id uuid,
  tenant_name text,
  is_master boolean,
  profile_created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    ur.user_id,
    p.full_name,
    p.tenant_id,
    t.name as tenant_name,
    public.is_master(ur.user_id) as is_master,
    p.created_at
  FROM public.user_roles ur
  INNER JOIN public.profiles p ON p.id = ur.user_id
  LEFT JOIN public.tenants t ON t.id = p.tenant_id
  WHERE ur.role = 'super_admin'
  ORDER BY p.created_at ASC
$$;

-- Criar função para listar todos os usuários do sistema (para o MASTER)
CREATE OR REPLACE FUNCTION public.get_all_users_for_master()
RETURNS TABLE(
  user_id uuid,
  full_name text,
  role text,
  tenant_id uuid,
  tenant_name text,
  is_super_admin boolean,
  profile_created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id as user_id,
    p.full_name,
    p.role,
    p.tenant_id,
    t.name as tenant_name,
    EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id = p.id AND ur.role = 'super_admin') as is_super_admin,
    p.created_at
  FROM public.profiles p
  LEFT JOIN public.tenants t ON t.id = p.tenant_id
  ORDER BY p.full_name ASC
$$;

-- Criar função para promover usuário a super admin (apenas MASTER pode)
CREATE OR REPLACE FUNCTION public.promote_to_super_admin(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_master(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas o MASTER pode promover usuários a Super Admin';
  END IF;
  
  IF EXISTS (SELECT 1 FROM user_roles WHERE user_id = p_user_id) THEN
    UPDATE user_roles SET role = 'super_admin' WHERE user_id = p_user_id;
  ELSE
    INSERT INTO user_roles (user_id, role) VALUES (p_user_id, 'super_admin');
  END IF;
END;
$$;

-- Criar função para remover super admin (apenas MASTER pode)
CREATE OR REPLACE FUNCTION public.remove_super_admin(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_master(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas o MASTER pode remover Super Admins';
  END IF;
  
  IF public.is_master(p_user_id) THEN
    RAISE EXCEPTION 'O MASTER não pode ser removido';
  END IF;
  
  UPDATE user_roles SET role = 'user' WHERE user_id = p_user_id AND role = 'super_admin';
END;
$$;