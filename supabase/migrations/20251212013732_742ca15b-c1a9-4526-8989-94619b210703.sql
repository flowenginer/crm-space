-- ============================================================================
-- FASE 0: INFRAESTRUTURA MULTI-TENANCY
-- ============================================================================

-- Etapa 0.1: Criar tabela de Tenants (Empresas)
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  logo_url TEXT,
  settings JSONB DEFAULT '{}',
  plan_type VARCHAR(50) DEFAULT 'free', -- free, starter, pro, enterprise
  max_users INTEGER DEFAULT 5,
  max_contacts INTEGER DEFAULT 1000,
  is_active BOOLEAN DEFAULT true,
  trial_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para tenants
CREATE INDEX idx_tenants_slug ON public.tenants(slug);
CREATE INDEX idx_tenants_active ON public.tenants(is_active);

-- RLS para tenants
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Etapa 0.2: Adicionar tenant_id na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_tenant ON public.profiles(tenant_id);

-- Função helper SECURITY DEFINER para obter tenant_id do usuário logado
-- Esta função é usada em RLS policies para evitar recursão infinita
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
$$;

-- Função para verificar se usuário pertence a um tenant
CREATE OR REPLACE FUNCTION public.user_belongs_to_tenant(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND tenant_id = p_tenant_id
  )
$$;

-- RLS para tenants - usuários só veem seu próprio tenant
CREATE POLICY "Users can view own tenant" ON public.tenants
  FOR SELECT USING (id = public.get_user_tenant_id());

CREATE POLICY "Admins can update own tenant" ON public.tenants
  FOR UPDATE USING (id = public.get_user_tenant_id() AND public.is_admin_or_supervisor(auth.uid()));

-- Etapa 0.3: Migrar tabelas de produtos existentes

-- 1. product_catalogs - adicionar tenant_id
ALTER TABLE public.product_catalogs 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_product_catalogs_tenant ON public.product_catalogs(tenant_id);

-- Remover política antiga e criar nova com tenant isolation
DROP POLICY IF EXISTS "Authenticated users can manage product catalogs" ON public.product_catalogs;

CREATE POLICY "Tenant isolation for product_catalogs" ON public.product_catalogs
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

-- 2. product_attribute_types - adicionar tenant_id
ALTER TABLE public.product_attribute_types 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_product_attribute_types_tenant ON public.product_attribute_types(tenant_id);

-- Remover política antiga e criar nova
DROP POLICY IF EXISTS "Authenticated users can manage attribute types" ON public.product_attribute_types;

CREATE POLICY "Tenant isolation for product_attribute_types" ON public.product_attribute_types
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

-- 3. product_attribute_values - adicionar tenant_id
ALTER TABLE public.product_attribute_values 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_product_attribute_values_tenant ON public.product_attribute_values(tenant_id);

-- Remover política antiga e criar nova
DROP POLICY IF EXISTS "Authenticated users can manage attribute values" ON public.product_attribute_values;

CREATE POLICY "Tenant isolation for product_attribute_values" ON public.product_attribute_values
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

-- 4. product_attribute_price_rules - adicionar tenant_id
ALTER TABLE public.product_attribute_price_rules 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_product_attribute_price_rules_tenant ON public.product_attribute_price_rules(tenant_id);

-- Remover política antiga e criar nova
DROP POLICY IF EXISTS "Authenticated users can manage price rules" ON public.product_attribute_price_rules;

CREATE POLICY "Tenant isolation for product_attribute_price_rules" ON public.product_attribute_price_rules
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

-- Trigger para atualizar updated_at em tenants
CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- FIM DA FASE 0
-- ============================================================================