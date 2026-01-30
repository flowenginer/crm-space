-- Drop existing functions to change return types
DROP FUNCTION IF EXISTS public.get_lead_intelligence_by_state(timestamptz, timestamptz);
DROP FUNCTION IF EXISTS public.get_lead_intelligence_by_segment(timestamptz, timestamptz, text);

-- Recreate get_lead_intelligence_by_state with aligned logic (leads = conversations started in period, conversions = lead_status_history)
CREATE OR REPLACE FUNCTION public.get_lead_intelligence_by_state(
  p_date_from timestamptz,
  p_date_to timestamptz
)
RETURNS TABLE(
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
  v_tenant_id := (auth.jwt() ->> 'tenant_id')::uuid;

  RETURN QUERY
  WITH conversion_status_names AS (
    SELECT ls.name
    FROM public.company_settings cs
    JOIN unnest(cs.conversion_status_ids) AS conv_id ON true
    JOIN public.lead_statuses ls ON ls.id = conv_id
    WHERE cs.tenant_id = v_tenant_id
  ),
  leads_base AS (
    SELECT DISTINCT cv.contact_id
    FROM public.conversations cv
    WHERE cv.tenant_id = v_tenant_id
      AND cv.created_at >= p_date_from
      AND cv.created_at <= p_date_to
  ),
  converted_base AS (
    SELECT DISTINCT lsh.contact_id
    FROM public.lead_status_history lsh
    WHERE lsh.tenant_id = v_tenant_id
      AND lsh.changed_at >= p_date_from
      AND lsh.changed_at <= p_date_to
      AND lsh.new_status IN (SELECT name FROM conversion_status_names)
  ),
  enriched AS (
    SELECT
      lb.contact_id,
      COALESCE(c.state, 'Outro') AS contact_state,
      (cb.contact_id IS NOT NULL) AS is_converted,
      COALESCE(c.negotiated_value, 0)::numeric AS negotiated_value
    FROM leads_base lb
    JOIN public.contacts c
      ON c.id = lb.contact_id
     AND c.tenant_id = v_tenant_id
    LEFT JOIN converted_base cb
      ON cb.contact_id = lb.contact_id
  )
  SELECT
    e.contact_state AS state,
    COUNT(*)::bigint AS total_leads,
    COUNT(*) FILTER (WHERE e.is_converted)::bigint AS converted_leads,
    COALESCE(SUM(e.negotiated_value) FILTER (WHERE e.is_converted), 0)::numeric AS total_revenue,
    CASE
      WHEN COUNT(*) FILTER (WHERE e.is_converted) > 0
      THEN ROUND((COALESCE(SUM(e.negotiated_value) FILTER (WHERE e.is_converted), 0) / COUNT(*) FILTER (WHERE e.is_converted))::numeric, 2)
      ELSE 0
    END AS avg_ticket,
    CASE
      WHEN COUNT(*) > 0
      THEN ROUND((COUNT(*) FILTER (WHERE e.is_converted)::numeric / COUNT(*)::numeric) * 100, 2)
      ELSE 0
    END AS conversion_rate
  FROM enriched e
  GROUP BY e.contact_state
  ORDER BY total_leads DESC;
END;
$$;


-- Recreate get_lead_intelligence_by_segment with aligned logic
CREATE OR REPLACE FUNCTION public.get_lead_intelligence_by_segment(
  p_date_from timestamptz,
  p_date_to timestamptz,
  p_state text DEFAULT NULL
)
RETURNS TABLE(
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
  v_tenant_id := (auth.jwt() ->> 'tenant_id')::uuid;

  RETURN QUERY
  WITH conversion_status_names AS (
    SELECT ls.name
    FROM public.company_settings cs
    JOIN unnest(cs.conversion_status_ids) AS conv_id ON true
    JOIN public.lead_statuses ls ON ls.id = conv_id
    WHERE cs.tenant_id = v_tenant_id
  ),
  leads_base AS (
    SELECT DISTINCT cv.contact_id
    FROM public.conversations cv
    WHERE cv.tenant_id = v_tenant_id
      AND cv.created_at >= p_date_from
      AND cv.created_at <= p_date_to
  ),
  converted_base AS (
    SELECT DISTINCT lsh.contact_id
    FROM public.lead_status_history lsh
    WHERE lsh.tenant_id = v_tenant_id
      AND lsh.changed_at >= p_date_from
      AND lsh.changed_at <= p_date_to
      AND lsh.new_status IN (SELECT name FROM conversion_status_names)
  ),
  enriched AS (
    SELECT
      lb.contact_id,
      c.segment_id AS seg_id,
      COALESCE(s.name, 'Sem Segmento') AS seg_name,
      COALESCE(c.state, 'Outro') AS contact_state,
      (cb.contact_id IS NOT NULL) AS is_converted,
      COALESCE(c.negotiated_value, 0)::numeric AS negotiated_value
    FROM leads_base lb
    JOIN public.contacts c
      ON c.id = lb.contact_id
     AND c.tenant_id = v_tenant_id
    LEFT JOIN public.segments s
      ON s.id = c.segment_id
     AND s.tenant_id = v_tenant_id
    LEFT JOIN converted_base cb
      ON cb.contact_id = lb.contact_id
  )
  SELECT
    e.seg_id AS segment_id,
    e.seg_name AS segment_name,
    COUNT(*)::bigint AS total_leads,
    COUNT(*) FILTER (WHERE e.is_converted)::bigint AS converted_leads,
    COALESCE(SUM(e.negotiated_value) FILTER (WHERE e.is_converted), 0)::numeric AS total_revenue,
    CASE
      WHEN COUNT(*) FILTER (WHERE e.is_converted) > 0
      THEN ROUND((COALESCE(SUM(e.negotiated_value) FILTER (WHERE e.is_converted), 0) / COUNT(*) FILTER (WHERE e.is_converted))::numeric, 2)
      ELSE 0
    END AS avg_ticket,
    CASE
      WHEN COUNT(*) > 0
      THEN ROUND((COUNT(*) FILTER (WHERE e.is_converted)::numeric / COUNT(*)::numeric) * 100, 2)
      ELSE 0
    END AS conversion_rate
  FROM enriched e
  WHERE (p_state IS NULL OR e.contact_state = p_state)
  GROUP BY e.seg_id, e.seg_name
  ORDER BY total_leads DESC;
END;
$$;