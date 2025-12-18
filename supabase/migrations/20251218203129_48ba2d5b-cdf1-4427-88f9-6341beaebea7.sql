-- Atualizar RPC get_returning_leads_metrics para incluir filtro por origem
CREATE OR REPLACE FUNCTION public.get_returning_leads_metrics(
  p_date_from TIMESTAMPTZ,
  p_date_to TIMESTAMPTZ,
  p_agent_id UUID DEFAULT NULL,
  p_department_id UUID DEFAULT NULL,
  p_channel_id UUID DEFAULT NULL,
  p_origin TEXT DEFAULT NULL
)
RETURNS TABLE (
  total_conversations BIGINT,
  new_contacts BIGINT,
  returning_contacts BIGINT,
  new_contact_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH conversation_contacts AS (
    SELECT 
      c.id as conversation_id,
      c.contact_id,
      c.created_at as conv_created_at,
      ct.first_contact_at,
      c.referral_source
    FROM conversations c
    INNER JOIN contacts ct ON ct.id = c.contact_id
    WHERE c.created_at >= p_date_from
      AND c.created_at <= p_date_to
      AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
      AND (p_department_id IS NULL OR c.department_id = p_department_id)
      AND (p_channel_id IS NULL OR c.channel_id = p_channel_id)
      AND (
        p_origin IS NULL 
        OR (p_origin = 'meta_ads' AND c.referral_source = 'meta_ads')
        OR (p_origin = 'organic' AND (c.referral_source IS NULL OR c.referral_source != 'meta_ads'))
      )
  ),
  metrics AS (
    SELECT
      COUNT(*) as total_conv,
      COUNT(*) FILTER (
        WHERE first_contact_at IS NULL 
        OR first_contact_at >= p_date_from
      ) as new_cnt,
      COUNT(*) FILTER (
        WHERE first_contact_at IS NOT NULL 
        AND first_contact_at < p_date_from
      ) as returning_cnt
    FROM conversation_contacts
  )
  SELECT 
    m.total_conv::BIGINT as total_conversations,
    m.new_cnt::BIGINT as new_contacts,
    m.returning_cnt::BIGINT as returning_contacts,
    CASE 
      WHEN m.total_conv > 0 
      THEN ROUND((m.new_cnt::NUMERIC / m.total_conv) * 100, 1)
      ELSE 0 
    END as new_contact_rate
  FROM metrics m;
END;
$$;