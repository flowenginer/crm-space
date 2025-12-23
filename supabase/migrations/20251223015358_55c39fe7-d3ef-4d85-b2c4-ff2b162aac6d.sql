-- Criar tabela para configurar módulos disponíveis por tenant
CREATE TABLE public.tenant_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, module_key)
);

-- Habilitar RLS
ALTER TABLE public.tenant_modules ENABLE ROW LEVEL SECURITY;

-- Apenas super admins podem gerenciar módulos
CREATE POLICY "Super admins can manage tenant modules"
ON public.tenant_modules
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);

-- Usuários podem ver módulos do próprio tenant
CREATE POLICY "Users can view own tenant modules"
ON public.tenant_modules
FOR SELECT
USING (tenant_id = get_user_tenant_id());

-- Criar índice para performance
CREATE INDEX idx_tenant_modules_tenant_id ON public.tenant_modules(tenant_id);

-- Trigger para updated_at
CREATE TRIGGER update_tenant_modules_updated_at
  BEFORE UPDATE ON public.tenant_modules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Função para verificar se um módulo está habilitado para o tenant do usuário
CREATE OR REPLACE FUNCTION public.is_module_enabled(p_module_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_enabled 
     FROM tenant_modules 
     WHERE tenant_id = get_user_tenant_id() 
     AND module_key = p_module_key),
    true -- Por padrão, módulos são habilitados se não houver configuração
  );
$$;

-- Inserir módulos padrão para o tenant existente (Space Sport)
INSERT INTO public.tenant_modules (tenant_id, module_key, is_enabled)
SELECT 
  '00000000-0000-0000-0000-000000000001'::uuid as tenant_id,
  module_key,
  true as is_enabled
FROM (
  VALUES 
    ('conversations'),
    ('crm'),
    ('contacts'),
    ('orders'),
    ('quotes'),
    ('products'),
    ('financial'),
    ('reports'),
    ('campaigns'),
    ('gamification'),
    ('automations'),
    ('bulk_dispatch'),
    ('internal_chat'),
    ('internal_email'),
    ('live_monitor'),
    ('settings'),
    ('webhooks'),
    ('whatsapp_channels')
) AS modules(module_key)
ON CONFLICT DO NOTHING;