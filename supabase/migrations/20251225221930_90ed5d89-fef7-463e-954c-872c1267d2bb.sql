-- Função para calcular mediana e distribuição por faixas do tempo de atribuição
CREATE OR REPLACE FUNCTION get_assignment_time_distribution(
  p_date_from TIMESTAMPTZ,
  p_date_to TIMESTAMPTZ,
  p_agent_id UUID DEFAULT NULL,
  p_department_id UUID DEFAULT NULL,
  p_channel_id UUID DEFAULT NULL,
  p_origin TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
  user_tenant UUID;
BEGIN
  user_tenant := get_user_tenant_id();
  
  WITH filtered_times AS (
    SELECT lah.time_to_assign_seconds
    FROM lead_assignment_history lah
    INNER JOIN conversations c ON c.id = lah.conversation_id
    WHERE lah.assigned_at >= p_date_from
      AND lah.assigned_at <= p_date_to
      AND lah.time_to_assign_seconds IS NOT NULL
      AND lah.time_to_assign_seconds >= 0
      AND c.tenant_id = user_tenant
      AND (p_agent_id IS NULL OR lah.assigned_to = p_agent_id)
      AND (p_department_id IS NULL OR c.department_id = p_department_id)
      AND (p_channel_id IS NULL OR c.channel_id = p_channel_id)
      AND (p_origin IS NULL OR c.referral_source = p_origin)
  ),
  distribution_counts AS (
    SELECT 
      SUM(CASE WHEN time_to_assign_seconds < 60 THEN 1 ELSE 0 END) as less_1min,
      SUM(CASE WHEN time_to_assign_seconds >= 60 AND time_to_assign_seconds < 300 THEN 1 ELSE 0 END) as range_1_5min,
      SUM(CASE WHEN time_to_assign_seconds >= 300 AND time_to_assign_seconds < 900 THEN 1 ELSE 0 END) as range_5_15min,
      SUM(CASE WHEN time_to_assign_seconds >= 900 AND time_to_assign_seconds < 3600 THEN 1 ELSE 0 END) as range_15_60min,
      SUM(CASE WHEN time_to_assign_seconds >= 3600 AND time_to_assign_seconds < 86400 THEN 1 ELSE 0 END) as range_1_24h,
      SUM(CASE WHEN time_to_assign_seconds >= 86400 THEN 1 ELSE 0 END) as more_24h,
      COUNT(*) as total
    FROM filtered_times
  ),
  median_calc AS (
    SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY time_to_assign_seconds) as median_value
    FROM filtered_times
  )
  SELECT json_build_object(
    'median', COALESCE((SELECT median_value FROM median_calc), 0),
    'total', COALESCE((SELECT total FROM distribution_counts), 0),
    'distribution', (
      SELECT json_agg(
        json_build_object(
          'range', range_name,
          'count', range_count,
          'percentage', CASE WHEN dc.total > 0 THEN ROUND((range_count::NUMERIC / dc.total) * 100, 1) ELSE 0 END,
          'order', range_order
        ) ORDER BY range_order
      )
      FROM distribution_counts dc,
      LATERAL (
        VALUES 
          ('< 1 min', dc.less_1min, 1),
          ('1-5 min', dc.range_1_5min, 2),
          ('5-15 min', dc.range_5_15min, 3),
          ('15-60 min', dc.range_15_60min, 4),
          ('1-24 horas', dc.range_1_24h, 5),
          ('> 24 horas', dc.more_24h, 6)
      ) AS ranges(range_name, range_count, range_order)
    )
  ) INTO result;
  
  RETURN result;
END;
$$;