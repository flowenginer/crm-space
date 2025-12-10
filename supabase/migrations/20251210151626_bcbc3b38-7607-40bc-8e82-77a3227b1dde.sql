
-- =====================================================
-- FASE 5: RPCs Batch para Dashboard (eliminar N+1)
-- =====================================================

-- 5.1 get_leads_by_status_batch: Uma única query para todos os status
CREATE OR REPLACE FUNCTION public.get_leads_by_status_batch(
  p_date_from TIMESTAMPTZ,
  p_date_to TIMESTAMPTZ,
  p_agent_id UUID DEFAULT NULL,
  p_department_id UUID DEFAULT NULL
)
RETURNS TABLE(
  status_id UUID,
  status_name TEXT,
  status_color TEXT,
  order_position INTEGER,
  count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ls.id as status_id,
    ls.name as status_name,
    ls.color as status_color,
    ls.order_position,
    COALESCE(counts.cnt, 0)::BIGINT as count
  FROM lead_statuses ls
  LEFT JOIN (
    SELECT 
      c.lead_status,
      COUNT(DISTINCT c.contact_id) as cnt
    FROM conversations c
    WHERE c.created_at >= p_date_from
      AND c.created_at <= p_date_to
      AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
      AND (p_department_id IS NULL OR c.department_id = p_department_id)
    GROUP BY c.lead_status
  ) counts ON ls.name = counts.lead_status
  WHERE ls.is_active = true
  ORDER BY ls.order_position;
END;
$$;

-- 5.2 get_timeline_data_batch: Uma única query para todos os dias
CREATE OR REPLACE FUNCTION public.get_timeline_data_batch(
  p_date_from TIMESTAMPTZ,
  p_date_to TIMESTAMPTZ,
  p_agent_id UUID DEFAULT NULL,
  p_department_id UUID DEFAULT NULL,
  p_conversion_status_names TEXT[] DEFAULT ARRAY[]::TEXT[]
)
RETURNS TABLE(
  date DATE,
  new_leads BIGINT,
  conversions BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(
      p_date_from::DATE,
      p_date_to::DATE,
      '1 day'::INTERVAL
    )::DATE as day
  ),
  daily_leads AS (
    SELECT 
      c.created_at::DATE as day,
      COUNT(DISTINCT c.contact_id) as cnt
    FROM conversations c
    WHERE c.created_at >= p_date_from
      AND c.created_at <= p_date_to
      AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
      AND (p_department_id IS NULL OR c.department_id = p_department_id)
    GROUP BY c.created_at::DATE
  ),
  daily_conversions AS (
    SELECT 
      lsh.changed_at::DATE as day,
      COUNT(DISTINCT lsh.contact_id) as cnt
    FROM lead_status_history lsh
    INNER JOIN conversations c ON c.contact_id = lsh.contact_id
    WHERE lsh.new_status = ANY(p_conversion_status_names)
      AND lsh.changed_at >= p_date_from
      AND lsh.changed_at <= p_date_to
      AND c.created_at >= p_date_from
      AND c.created_at <= p_date_to
      AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
      AND (p_department_id IS NULL OR c.department_id = p_department_id)
    GROUP BY lsh.changed_at::DATE
  )
  SELECT 
    ds.day as date,
    COALESCE(dl.cnt, 0)::BIGINT as new_leads,
    COALESCE(dc.cnt, 0)::BIGINT as conversions
  FROM date_series ds
  LEFT JOIN daily_leads dl ON ds.day = dl.day
  LEFT JOIN daily_conversions dc ON ds.day = dc.day
  ORDER BY ds.day;
END;
$$;

-- 5.3 get_funnel_data_batch: Uma única query para todos os stages
CREATE OR REPLACE FUNCTION public.get_funnel_data_batch(
  p_date_from TIMESTAMPTZ,
  p_date_to TIMESTAMPTZ,
  p_agent_id UUID DEFAULT NULL,
  p_department_id UUID DEFAULT NULL
)
RETURNS TABLE(
  stage_name TEXT,
  stage_color TEXT,
  order_position INTEGER,
  count BIGINT,
  avg_duration_seconds NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ls.name as stage_name,
    ls.color as stage_color,
    ls.order_position,
    COALESCE(counts.cnt, 0)::BIGINT as count,
    COALESCE(durations.avg_duration, 0)::NUMERIC as avg_duration_seconds
  FROM lead_statuses ls
  LEFT JOIN (
    SELECT 
      c.lead_status,
      COUNT(DISTINCT c.contact_id) as cnt
    FROM conversations c
    WHERE c.created_at >= p_date_from
      AND c.created_at <= p_date_to
      AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
      AND (p_department_id IS NULL OR c.department_id = p_department_id)
    GROUP BY c.lead_status
  ) counts ON ls.name = counts.lead_status
  LEFT JOIN (
    SELECT 
      lsh.new_status,
      AVG(lsh.duration_seconds) as avg_duration
    FROM lead_status_history lsh
    INNER JOIN conversations c ON c.contact_id = lsh.contact_id
    WHERE lsh.changed_at >= p_date_from
      AND lsh.changed_at <= p_date_to
      AND lsh.duration_seconds IS NOT NULL
      AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
      AND (p_department_id IS NULL OR c.department_id = p_department_id)
    GROUP BY lsh.new_status
  ) durations ON ls.name = durations.new_status
  WHERE ls.is_active = true
  ORDER BY ls.order_position;
END;
$$;

-- =====================================================
-- FASE 6: Otimizar filtros de tags em conversas
-- =====================================================

-- 6.1 get_conversations_by_tags: RPC otimizada para filtro de tags
CREATE OR REPLACE FUNCTION public.get_conversations_by_tags(
  p_tag_ids UUID[],
  p_exclude_no_tags BOOLEAN DEFAULT FALSE,
  p_department_id UUID DEFAULT NULL,
  p_agent_id UUID DEFAULT NULL,
  p_channel_id UUID DEFAULT NULL,
  p_origin TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
  conversation_id UUID,
  contact_id UUID,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total BIGINT;
BEGIN
  -- Count total first
  IF array_length(p_tag_ids, 1) > 0 THEN
    SELECT COUNT(DISTINCT c.id) INTO v_total
    FROM conversations c
    INNER JOIN contact_tags ct ON ct.contact_id = c.contact_id
    WHERE c.status IN ('open', 'pending')
      AND ct.tag_id = ANY(p_tag_ids)
      AND (p_department_id IS NULL OR c.department_id = p_department_id)
      AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
      AND (p_channel_id IS NULL OR c.channel_id = p_channel_id)
      AND (p_origin IS NULL OR 
           (p_origin = 'meta_ads' AND c.referral_source = 'meta_ads') OR
           (p_origin = 'organic' AND (c.referral_source IS NULL OR c.referral_source != 'meta_ads')));
  ELSIF p_exclude_no_tags THEN
    SELECT COUNT(DISTINCT c.id) INTO v_total
    FROM conversations c
    WHERE c.status IN ('open', 'pending')
      AND NOT EXISTS (SELECT 1 FROM contact_tags ct WHERE ct.contact_id = c.contact_id)
      AND (p_department_id IS NULL OR c.department_id = p_department_id)
      AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
      AND (p_channel_id IS NULL OR c.channel_id = p_channel_id)
      AND (p_origin IS NULL OR 
           (p_origin = 'meta_ads' AND c.referral_source = 'meta_ads') OR
           (p_origin = 'organic' AND (c.referral_source IS NULL OR c.referral_source != 'meta_ads')));
  ELSE
    v_total := 0;
  END IF;

  -- Return results with total
  IF array_length(p_tag_ids, 1) > 0 THEN
    RETURN QUERY
    SELECT DISTINCT c.id as conversation_id, c.contact_id, v_total as total_count
    FROM conversations c
    INNER JOIN contact_tags ct ON ct.contact_id = c.contact_id
    WHERE c.status IN ('open', 'pending')
      AND ct.tag_id = ANY(p_tag_ids)
      AND (p_department_id IS NULL OR c.department_id = p_department_id)
      AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
      AND (p_channel_id IS NULL OR c.channel_id = p_channel_id)
      AND (p_origin IS NULL OR 
           (p_origin = 'meta_ads' AND c.referral_source = 'meta_ads') OR
           (p_origin = 'organic' AND (c.referral_source IS NULL OR c.referral_source != 'meta_ads')))
    ORDER BY c.id
    LIMIT p_limit
    OFFSET p_offset;
  ELSIF p_exclude_no_tags THEN
    RETURN QUERY
    SELECT DISTINCT c.id as conversation_id, c.contact_id, v_total as total_count
    FROM conversations c
    WHERE c.status IN ('open', 'pending')
      AND NOT EXISTS (SELECT 1 FROM contact_tags ct WHERE ct.contact_id = c.contact_id)
      AND (p_department_id IS NULL OR c.department_id = p_department_id)
      AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
      AND (p_channel_id IS NULL OR c.channel_id = p_channel_id)
      AND (p_origin IS NULL OR 
           (p_origin = 'meta_ads' AND c.referral_source = 'meta_ads') OR
           (p_origin = 'organic' AND (c.referral_source IS NULL OR c.referral_source != 'meta_ads')))
    ORDER BY c.id
    LIMIT p_limit
    OFFSET p_offset;
  END IF;
END;
$$;

-- =====================================================
-- FASE 7: Incluir pending count no RPC existente (já existe, verificar se inclui)
-- =====================================================

-- Adicionar índices para otimização
CREATE INDEX IF NOT EXISTS idx_conversations_created_at_status ON conversations(created_at, status);
CREATE INDEX IF NOT EXISTS idx_conversations_lead_status ON conversations(lead_status);
CREATE INDEX IF NOT EXISTS idx_lead_status_history_changed_at ON lead_status_history(changed_at);
CREATE INDEX IF NOT EXISTS idx_lead_status_history_new_status ON lead_status_history(new_status);
CREATE INDEX IF NOT EXISTS idx_contact_tags_contact_tag ON contact_tags(contact_id, tag_id);
