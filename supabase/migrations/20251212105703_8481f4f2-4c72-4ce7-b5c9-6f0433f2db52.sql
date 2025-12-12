-- Função para buscar contagens de conversas por lead status do contato
CREATE OR REPLACE FUNCTION public.get_lead_status_counts(
  p_department_id UUID DEFAULT NULL,
  p_agent_id UUID DEFAULT NULL,
  p_channel_id UUID DEFAULT NULL,
  p_origin TEXT DEFAULT NULL,
  p_status_filter TEXT DEFAULT 'active'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT COALESCE(jsonb_object_agg(lead_status, cnt), '{}'::jsonb)
  INTO result
  FROM (
    SELECT 
      c.lead_status,
      COUNT(DISTINCT conv.id) as cnt
    FROM contacts c
    INNER JOIN conversations conv ON conv.contact_id = c.id
    WHERE 
      c.lead_status IS NOT NULL
      AND c.lead_status != ''
      -- Status filter
      AND (
        p_status_filter = 'all' 
        OR (p_status_filter = 'active' AND conv.status IN ('open', 'pending'))
        OR (p_status_filter = 'open' AND conv.status = 'open')
        OR (p_status_filter = 'pending' AND conv.status = 'pending')
        OR (p_status_filter = 'closed' AND conv.status = 'closed')
      )
      -- Department filter
      AND (p_department_id IS NULL OR conv.department_id = p_department_id)
      -- Agent filter
      AND (p_agent_id IS NULL OR conv.assigned_to = p_agent_id)
      -- Channel filter
      AND (p_channel_id IS NULL OR conv.channel_id = p_channel_id)
      -- Origin filter
      AND (
        p_origin IS NULL 
        OR (p_origin = 'meta_ads' AND conv.referral_source = 'meta_ads')
        OR (p_origin = 'organic' AND (conv.referral_source IS NULL OR conv.referral_source != 'meta_ads'))
      )
    GROUP BY c.lead_status
  ) counts;
  
  RETURN result;
END;
$$;