-- Create table for tenant notification configuration
CREATE TABLE public.tenant_notification_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  quote_expiration_enabled BOOLEAN DEFAULT false,
  quote_expiration_days INTEGER[] DEFAULT '{3, 1}',
  quote_expiration_template TEXT DEFAULT 'Olá {cliente_nome}! 👋

Seu orçamento #{numero} no valor de {valor} expira em {dias_restantes}.

📅 Validade: {data_validade}

Posso te ajudar a finalizar?',
  notification_channel_id UUID REFERENCES public.whatsapp_channels(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(tenant_id)
);

-- Create table for quote expiration notifications history
CREATE TABLE public.quote_expiration_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  quote_id UUID REFERENCES public.quotes(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  channel_id UUID REFERENCES public.whatsapp_channels(id) ON DELETE SET NULL,
  notification_type TEXT NOT NULL,
  days_before INTEGER NOT NULL,
  scheduled_for TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tenant_notification_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_expiration_notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies for tenant_notification_config
CREATE POLICY "Tenant isolation for tenant_notification_config"
ON public.tenant_notification_config
FOR ALL
USING (tenant_id = get_user_tenant_id());

-- RLS policies for quote_expiration_notifications
CREATE POLICY "Tenant isolation for quote_expiration_notifications"
ON public.quote_expiration_notifications
FOR ALL
USING (tenant_id = get_user_tenant_id());

-- Indexes
CREATE INDEX idx_quote_notifications_status ON public.quote_expiration_notifications(status);
CREATE INDEX idx_quote_notifications_scheduled ON public.quote_expiration_notifications(scheduled_for);
CREATE INDEX idx_quote_notifications_quote ON public.quote_expiration_notifications(quote_id);
CREATE INDEX idx_tenant_config_tenant ON public.tenant_notification_config(tenant_id);