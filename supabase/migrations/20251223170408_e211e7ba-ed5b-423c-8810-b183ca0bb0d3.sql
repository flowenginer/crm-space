
-- FASE 1: Remover funções RPC duplicadas que não filtram por tenant_id
-- Isso corrige o vazamento de dados entre tenants no Dashboard

-- Drop get_lead_journey_metrics com 5 args (versão antiga com p_start_date/p_end_date)
DROP FUNCTION IF EXISTS public.get_lead_journey_metrics(
  p_start_date timestamp with time zone,
  p_end_date timestamp with time zone,
  p_agent_id uuid,
  p_department_id uuid,
  p_channel_id uuid
);

-- Drop get_lead_journey_metrics com 6 args (versão com conversion_status_names)
DROP FUNCTION IF EXISTS public.get_lead_journey_metrics(
  p_date_from timestamp with time zone,
  p_date_to timestamp with time zone,
  p_agent_id uuid,
  p_department_id uuid,
  p_conversion_status_names text[],
  p_origin text
);

-- Drop get_lead_journey_metrics com 6 args (versão com channel_id)
DROP FUNCTION IF EXISTS public.get_lead_journey_metrics(
  p_date_from timestamp with time zone,
  p_date_to timestamp with time zone,
  p_agent_id uuid,
  p_department_id uuid,
  p_channel_id uuid,
  p_origin text
);

-- Drop get_leads_by_origin com 5 args (versão antiga com conversion_status_names)
DROP FUNCTION IF EXISTS public.get_leads_by_origin(
  p_date_from timestamp with time zone,
  p_date_to timestamp with time zone,
  p_agent_id uuid,
  p_department_id uuid,
  p_conversion_status_names text[]
);

-- Drop get_status_funnel com 5 args (versão antiga com origin)
DROP FUNCTION IF EXISTS public.get_status_funnel(
  p_date_from timestamp with time zone,
  p_date_to timestamp with time zone,
  p_agent_id uuid,
  p_department_id uuid,
  p_origin text
);
