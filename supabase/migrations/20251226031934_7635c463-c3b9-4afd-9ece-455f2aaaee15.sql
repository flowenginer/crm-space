-- ======================================
-- FASE 2: Sistema de Satisfação NPS/CSAT
-- ======================================

-- Criar tabela satisfaction_surveys
CREATE TABLE public.satisfaction_surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid REFERENCES public.tenants(id),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  agent_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  survey_type TEXT NOT NULL DEFAULT 'nps', -- 'nps' ou 'csat'
  score INTEGER, -- 0-10 para NPS, 1-5 para CSAT
  response TEXT, -- Emoji ou texto livre
  sent_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending', -- pending, sent, responded, expired
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.satisfaction_surveys ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Tenant isolation for satisfaction_surveys"
ON public.satisfaction_surveys
FOR ALL
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Authenticated access satisfaction_surveys"
ON public.satisfaction_surveys
FOR ALL
USING (auth.uid() IS NOT NULL);

-- Create trigger for updated_at
CREATE TRIGGER update_satisfaction_surveys_updated_at
  BEFORE UPDATE ON public.satisfaction_surveys
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ======================================
-- Desativar aba Financeiro
-- ======================================
UPDATE public.menu_items 
SET is_active = false 
WHERE module_key = 'reports_financial';