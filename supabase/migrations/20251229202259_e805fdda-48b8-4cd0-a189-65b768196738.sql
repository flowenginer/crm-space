-- Tabela para cache de tokens OAuth da REDE
CREATE TABLE public.rede_oauth_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id),
  environment TEXT NOT NULL CHECK (environment IN ('sandbox', 'production')),
  access_token TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, environment)
);

-- Enable RLS
ALTER TABLE public.rede_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Tenant isolation for rede_oauth_tokens"
ON public.rede_oauth_tokens
FOR ALL
USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- Trigger para updated_at
CREATE TRIGGER update_rede_oauth_tokens_updated_at
BEFORE UPDATE ON public.rede_oauth_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índice para busca rápida
CREATE INDEX idx_rede_oauth_tokens_lookup ON public.rede_oauth_tokens(tenant_id, environment, expires_at);