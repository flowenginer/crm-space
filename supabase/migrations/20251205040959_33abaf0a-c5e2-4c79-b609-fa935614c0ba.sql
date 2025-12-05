-- Remover política restritiva existente para SELECT
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

-- Criar nova política que permite todos os usuários autenticados visualizarem os roles
CREATE POLICY "Authenticated users can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (true);

-- Manter política de admins para gerenciar roles (já existe)
-- A política "Admins can manage all roles" já permite INSERT, UPDATE, DELETE para admins