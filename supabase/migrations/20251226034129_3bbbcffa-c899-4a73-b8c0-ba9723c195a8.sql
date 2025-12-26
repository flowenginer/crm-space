-- Create satisfaction configuration table
CREATE TABLE IF NOT EXISTS public.satisfaction_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid REFERENCES public.tenants(id),
  is_active BOOLEAN NOT NULL DEFAULT false,
  survey_type TEXT NOT NULL DEFAULT 'nps' CHECK (survey_type IN ('nps', 'csat')),
  delay_minutes INTEGER NOT NULL DEFAULT 5,
  message_nps TEXT NOT NULL DEFAULT 'Olá! 👋

Gostaríamos de saber sua opinião sobre o atendimento.

De 0 a 10, o quanto você recomendaria nosso atendimento a um amigo?

Responda apenas com o número. Sua opinião é muito importante para nós! 🙏',
  message_csat TEXT NOT NULL DEFAULT 'Olá! 👋

Como foi seu atendimento hoje?

😊 Ótimo (responda 5)
😐 Regular (responda 3)
😞 Ruim (responda 1)

Responda com o número correspondente!',
  send_only_business_hours BOOLEAN NOT NULL DEFAULT false,
  auto_close_on_response BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

-- Enable RLS
ALTER TABLE public.satisfaction_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Tenant isolation for satisfaction_config"
  ON public.satisfaction_config
  FOR ALL
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Authenticated users can view satisfaction_config"
  ON public.satisfaction_config
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage satisfaction_config"
  ON public.satisfaction_config
  FOR ALL
  USING (is_admin_or_supervisor(auth.uid()));

-- Add sent_survey_id to satisfaction_surveys to link back
ALTER TABLE public.satisfaction_surveys 
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS survey_message_id TEXT,
  ADD COLUMN IF NOT EXISTS sent_via_channel_id UUID REFERENCES public.whatsapp_channels(id);

-- Create index for pending surveys lookup
CREATE INDEX IF NOT EXISTS idx_satisfaction_surveys_pending 
  ON public.satisfaction_surveys(status, sent_at) 
  WHERE status IN ('pending', 'sent');

-- Add realtime for satisfaction_config
ALTER PUBLICATION supabase_realtime ADD TABLE public.satisfaction_config;

-- Create trigger for updated_at
CREATE TRIGGER update_satisfaction_config_updated_at
  BEFORE UPDATE ON public.satisfaction_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();