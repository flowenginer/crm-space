-- =====================================================
-- TABELA: CONFIGURAÇÕES DE WEBHOOK
-- =====================================================
CREATE TABLE public.webhook_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Identificação
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  
  -- Autenticação (opcional)
  auth_type TEXT DEFAULT 'none',
  auth_token TEXT,
  auth_header_name TEXT,
  auth_header_value TEXT,
  
  -- Eventos habilitados
  events JSONB DEFAULT '[]'::jsonb,
  
  -- Filtros (opcional)
  filters JSONB DEFAULT '{}'::jsonb,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Estatísticas
  total_sent INTEGER DEFAULT 0,
  total_success INTEGER DEFAULT 0,
  total_failed INTEGER DEFAULT 0,
  last_sent_at TIMESTAMPTZ,
  last_error TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

-- =====================================================
-- TABELA: LOG DE ENVIOS DE WEBHOOK
-- =====================================================
CREATE TABLE public.webhook_deliveries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  webhook_id UUID REFERENCES public.webhook_configs(id) ON DELETE CASCADE,
  
  -- Evento
  event_type TEXT NOT NULL,
  
  -- Payload enviado
  payload JSONB NOT NULL,
  
  -- Resposta
  status_code INTEGER,
  response_body TEXT,
  response_time_ms INTEGER,
  
  -- Status
  status TEXT DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ
);

-- =====================================================
-- ÍNDICES PARA PERFORMANCE
-- =====================================================
CREATE INDEX idx_webhook_configs_active ON public.webhook_configs(is_active) WHERE is_active = true;
CREATE INDEX idx_webhook_deliveries_webhook ON public.webhook_deliveries(webhook_id);
CREATE INDEX idx_webhook_deliveries_status ON public.webhook_deliveries(status);
CREATE INDEX idx_webhook_deliveries_event ON public.webhook_deliveries(event_type);
CREATE INDEX idx_webhook_deliveries_created ON public.webhook_deliveries(created_at DESC);

-- =====================================================
-- RLS POLICIES
-- =====================================================
ALTER TABLE public.webhook_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated access webhook_configs"
ON public.webhook_configs
FOR ALL
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated access webhook_deliveries"
ON public.webhook_deliveries
FOR ALL
USING (auth.uid() IS NOT NULL);

-- =====================================================
-- FUNÇÃO PARA INCREMENTAR ESTATÍSTICAS
-- =====================================================
CREATE OR REPLACE FUNCTION public.increment_webhook_stats(
  p_webhook_id UUID,
  p_is_success BOOLEAN,
  p_error_message TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE webhook_configs
  SET 
    total_sent = total_sent + 1,
    total_success = CASE WHEN p_is_success THEN total_success + 1 ELSE total_success END,
    total_failed = CASE WHEN NOT p_is_success THEN total_failed + 1 ELSE total_failed END,
    last_sent_at = NOW(),
    last_error = CASE WHEN NOT p_is_success THEN p_error_message ELSE last_error END,
    updated_at = NOW()
  WHERE id = p_webhook_id;
END;
$$;