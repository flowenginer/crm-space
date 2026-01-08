-- Criar tabela para histórico de eventos de canal WhatsApp
CREATE TABLE IF NOT EXISTS public.whatsapp_channel_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES whatsapp_channels(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'connected', 'disconnected', 'error'
  previous_status TEXT,
  new_status TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ, -- quando o admin viu/dispensou
  acknowledged_by UUID REFERENCES profiles(id)
);

-- Índices para consultas eficientes
CREATE INDEX idx_channel_events_tenant ON public.whatsapp_channel_events(tenant_id);
CREATE INDEX idx_channel_events_channel ON public.whatsapp_channel_events(channel_id);
CREATE INDEX idx_channel_events_created ON public.whatsapp_channel_events(created_at DESC);
CREATE INDEX idx_channel_events_unack ON public.whatsapp_channel_events(tenant_id) 
  WHERE acknowledged_at IS NULL;

-- RLS
ALTER TABLE public.whatsapp_channel_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view channel events from their tenant" ON public.whatsapp_channel_events
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "System can insert channel events" ON public.whatsapp_channel_events
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can acknowledge events from their tenant" ON public.whatsapp_channel_events
  FOR UPDATE USING (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  );