-- Criar função que verifica se usuário é admin OU supervisor
CREATE OR REPLACE FUNCTION public.is_admin_or_supervisor(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = _user_id 
    AND role IN ('admin', 'supervisor')
  );
END;
$$;

-- Remover política antiga
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

-- Criar nova política que permite admins E supervisores atualizarem perfis
CREATE POLICY "Admins and supervisors can update all profiles"
ON public.profiles 
FOR UPDATE
TO authenticated
USING (public.is_admin_or_supervisor(auth.uid()));