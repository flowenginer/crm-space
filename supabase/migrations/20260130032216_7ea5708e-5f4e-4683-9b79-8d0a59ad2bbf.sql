CREATE OR REPLACE FUNCTION public.get_lead_intelligence_by_state(
  p_date_from timestamptz,
  p_date_to timestamptz
)
RETURNS TABLE (
  state text,
  total_leads bigint,
  converted_leads bigint,
  total_revenue numeric,
  avg_ticket numeric,
  conversion_rate numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  SELECT get_user_tenant_id() INTO v_tenant_id;

  RETURN QUERY
  WITH conversion_status_names AS (
    SELECT ls.name
    FROM public.lead_statuses ls
    JOIN public.company_settings cs ON cs.tenant_id = ls.tenant_id
    WHERE ls.tenant_id = v_tenant_id
      AND cs.conversion_status_ids IS NOT NULL
      AND ls.id = ANY (cs.conversion_status_ids::uuid[])
  ),
  leads_base AS (
    SELECT DISTINCT cv.contact_id
    FROM public.conversations cv
    WHERE cv.tenant_id = v_tenant_id
      AND cv.created_at >= p_date_from
      AND cv.created_at < p_date_to + interval '1 day'
  ),
  converted_contacts AS (
    SELECT DISTINCT lsh.contact_id
    FROM public.lead_status_history lsh
    WHERE lsh.tenant_id = v_tenant_id
      AND lsh.changed_at >= p_date_from
      AND lsh.changed_at < p_date_to + interval '1 day'
      AND lsh.new_status IN (SELECT name FROM conversion_status_names)
  ),
  contact_states AS (
    SELECT 
      c.id as contact_id,
      COALESCE(c.state, 'Outro') as state
    FROM public.contacts c
    WHERE c.tenant_id = v_tenant_id
      AND c.id IN (SELECT contact_id FROM leads_base)
  )
  SELECT 
    cs.state::text,
    COUNT(DISTINCT cs.contact_id)::bigint as total_leads,
    COUNT(DISTINCT CASE WHEN cc.contact_id IS NOT NULL THEN cs.contact_id END)::bigint as converted_leads,
    COALESCE(SUM(CASE WHEN cc.contact_id IS NOT NULL THEN c.negotiated_value ELSE 0 END), 0)::numeric as total_revenue,
    CASE 
      WHEN COUNT(DISTINCT CASE WHEN cc.contact_id IS NOT NULL THEN cs.contact_id END) > 0 
      THEN ROUND(COALESCE(SUM(CASE WHEN cc.contact_id IS NOT NULL THEN c.negotiated_value ELSE 0 END), 0) /
           COUNT(DISTINCT CASE WHEN cc.contact_id IS NOT NULL THEN cs.contact_id END), 2)
      ELSE 0
    END::numeric as avg_ticket,
    CASE 
      WHEN COUNT(DISTINCT cs.contact_id) > 0
      THEN ROUND((COUNT(DISTINCT CASE WHEN cc.contact_id IS NOT NULL THEN cs.contact_id END)::numeric /
           COUNT(DISTINCT cs.contact_id)::numeric) * 100, 2)
      ELSE 0
    END::numeric as conversion_rate
  FROM contact_states cs
  LEFT JOIN converted_contacts cc ON cc.contact_id = cs.contact_id
  LEFT JOIN public.contacts c ON c.id = cs.contact_id
  GROUP BY cs.state
  ORDER BY COUNT(DISTINCT cs.contact_id) DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_lead_intelligence_by_segment(
  p_date_from timestamptz,
  p_date_to timestamptz,
  p_state text DEFAULT NULL
)
RETURNS TABLE (
  segment_id uuid,
  segment_name text,
  total_leads bigint,
  converted_leads bigint,
  total_revenue numeric,
  avg_ticket numeric,
  conversion_rate numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  SELECT get_user_tenant_id() INTO v_tenant_id;

  RETURN QUERY
  WITH conversion_status_names AS (
    SELECT ls.name
    FROM public.lead_statuses ls
    JOIN public.company_settings cs ON cs.tenant_id = ls.tenant_id
    WHERE ls.tenant_id = v_tenant_id
      AND cs.conversion_status_ids IS NOT NULL
      AND ls.id = ANY (cs.conversion_status_ids::uuid[])
  ),
  leads_base AS (
    SELECT DISTINCT cv.contact_id
    FROM public.conversations cv
    WHERE cv.tenant_id = v_tenant_id
      AND cv.created_at >= p_date_from
      AND cv.created_at < p_date_to + interval '1 day'
  ),
  converted_contacts AS (
    SELECT DISTINCT lsh.contact_id
    FROM public.lead_status_history lsh
    WHERE lsh.tenant_id = v_tenant_id
      AND lsh.changed_at >= p_date_from
      AND lsh.changed_at < p_date_to + interval '1 day'
      AND lsh.new_status IN (SELECT name FROM conversion_status_names)
  ),
  contact_segments AS (
    SELECT 
      c.id as contact_id,
      c.segment_id,
      c.state,
      COALESCE(s.name, 'Sem segmento') as segment_name
    FROM public.contacts c
    LEFT JOIN public.segments s ON s.id = c.segment_id
    WHERE c.tenant_id = v_tenant_id
      AND c.id IN (SELECT contact_id FROM leads_base)
      AND (p_state IS NULL OR c.state = p_state)
  )
  SELECT 
    cs.segment_id::uuid,
    cs.segment_name::text,
    COUNT(DISTINCT cs.contact_id)::bigint as total_leads,
    COUNT(DISTINCT CASE WHEN cc.contact_id IS NOT NULL THEN cs.contact_id END)::bigint as converted_leads,
    COALESCE(SUM(CASE WHEN cc.contact_id IS NOT NULL THEN c.negotiated_value ELSE 0 END), 0)::numeric as total_revenue,
    CASE 
      WHEN COUNT(DISTINCT CASE WHEN cc.contact_id IS NOT NULL THEN cs.contact_id END) > 0
      THEN ROUND(COALESCE(SUM(CASE WHEN cc.contact_id IS NOT NULL THEN c.negotiated_value ELSE 0 END), 0) /
           COUNT(DISTINCT CASE WHEN cc.contact_id IS NOT NULL THEN cs.contact_id END), 2)
      ELSE 0
    END::numeric as avg_ticket,
    CASE 
      WHEN COUNT(DISTINCT cs.contact_id) > 0
      THEN ROUND((COUNT(DISTINCT CASE WHEN cc.contact_id IS NOT NULL THEN cs.contact_id END)::numeric /
           COUNT(DISTINCT cs.contact_id)::numeric) * 100, 2)
      ELSE 0
    END::numeric as conversion_rate
  FROM contact_segments cs
  LEFT JOIN converted_contacts cc ON cc.contact_id = cs.contact_id
  LEFT JOIN public.contacts c ON c.id = cs.contact_id
  GROUP BY cs.segment_id, cs.segment_name
  ORDER BY COUNT(DISTINCT cs.contact_id) DESC;
END;
$$;