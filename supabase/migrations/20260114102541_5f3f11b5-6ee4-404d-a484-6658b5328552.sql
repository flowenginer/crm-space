-- Tabela para armazenar API Keys de integração
CREATE TABLE public.integration_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  api_key TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  permissions JSONB DEFAULT '{"send_message": true, "read_contacts": false}'::jsonb,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id)
);

-- Índices
CREATE INDEX idx_integration_api_keys_tenant ON public.integration_api_keys(tenant_id);
CREATE INDEX idx_integration_api_keys_api_key ON public.integration_api_keys(api_key) WHERE is_active = true;

-- Habilitar RLS
ALTER TABLE public.integration_api_keys ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Tenant isolation for integration_api_keys"
ON public.integration_api_keys
FOR ALL
USING (tenant_id IN (
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
));

-- Comentário
COMMENT ON TABLE public.integration_api_keys IS 'API Keys para integrações externas (N8N, Zapier, etc.)';