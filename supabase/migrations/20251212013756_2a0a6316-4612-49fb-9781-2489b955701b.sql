-- Corrigir avisos de segurança das funções criadas

-- Adicionar policy de INSERT para tenants (necessário para criar novos tenants)
CREATE POLICY "Users can create tenant" ON public.tenants
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Nota: Os warnings de "Function Search Path Mutable" são de funções antigas do sistema
-- As funções get_user_tenant_id e user_belongs_to_tenant já têm SET search_path = public