-- Add owner agent settings columns to company_settings
ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS owner_agent_enabled boolean DEFAULT true;

ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS owner_agent_inactivity_days integer DEFAULT 7;

ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS owner_agent_on_reopen boolean DEFAULT true;

ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS owner_agent_reopen_reasons text[] DEFAULT ARRAY['sold', 'no_interest', 'future_contact'];

COMMENT ON COLUMN public.company_settings.owner_agent_enabled IS 'Ativa regras de reatribuição automática para atendente responsável';
COMMENT ON COLUMN public.company_settings.owner_agent_inactivity_days IS 'Dias de inatividade para reatribuir conversa ao atendente responsável';
COMMENT ON COLUMN public.company_settings.owner_agent_on_reopen IS 'Reatribuir ao atendente responsável quando conversa for reaberta';
COMMENT ON COLUMN public.company_settings.owner_agent_reopen_reasons IS 'Motivos de fechamento que ativam a reatribuição ao responsável';