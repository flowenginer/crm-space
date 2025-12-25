-- Remove versão antiga da função get_lead_journey_metrics (5 parâmetros - sem p_channel_id)
-- Isso deixará apenas a versão correta (6 parâmetros) que retorna assigned_conversations e assignment_rate
DROP FUNCTION IF EXISTS get_lead_journey_metrics(
  timestamp with time zone, 
  timestamp with time zone, 
  uuid, 
  uuid, 
  text
);