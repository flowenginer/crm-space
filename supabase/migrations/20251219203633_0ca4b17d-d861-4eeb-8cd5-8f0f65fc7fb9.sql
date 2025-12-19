-- Eliminar overload que ainda causa conflito no PostgREST
DROP FUNCTION IF EXISTS public.get_lead_journey_metrics(TIMESTAMPTZ, TIMESTAMPTZ, UUID, UUID, UUID, TEXT[], TEXT);

-- Recriar a versão única (JSON) com métricas necessárias p/ cards
DROP FUNCTION IF EXISTS public.get_lead_journey_metrics(TIMESTAMPTZ, TIMESTAMPTZ, UUID, UUID, UUID, TEXT);

CREATE FUNCTION public.get_lead_journey_metrics(
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
  v_conversion_status_names TEXT[];
  v_total_conversations BIGINT;
  v_assigned_conversations BIGINT;
BEGIN
  -- Status de conversão (nomes) a partir do company_settings
  SELECT COALESCE(array_agg(ls.name), ARRAY[]::TEXT[])
  INTO v_conversion_status_names
  FROM company_settings cs
  CROSS JOIN LATERAL unnest(cs.conversion_status_ids) AS csid
  JOIN lead_statuses ls ON ls.id::text = csid;

  -- Total de conversas no período (base para taxa de atribuição)
  SELECT COUNT(*)::BIGINT
  INTO v_total_conversations
  FROM conversations c
  JOIN contacts ct ON ct.id = c.contact_id
  WHERE c.created_at >= p_date_from
    AND c.created_at < p_date_to
    AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
    AND (p_department_id IS NULL OR c.department_id = p_department_id)
    AND (p_channel_id IS NULL OR c.channel_id = p_channel_id)
    AND (
      p_origin IS NULL OR p_origin = 'all'
      OR (p_origin = 'meta_ads' AND c.referral_source = 'meta_ads')
      OR (p_origin = 'linktree' AND c.referral_source = 'linktree')
      OR (p_origin = 'site' AND c.referral_source = 'site')
      OR (p_origin = 'manual' AND (ct.origin = 'manual' OR ct.origin = 'import'))
      OR (p_origin = 'referral' AND (ct.origin ILIKE '%indica%' OR ct.origin ILIKE '%referral%'))
      OR (p_origin = 'organic_unknown' AND (
          c.referral_source IS NULL OR c.referral_source NOT IN ('meta_ads', 'linktree', 'site')
        )
        AND NOT (ct.origin = 'manual' OR ct.origin = 'import')
        AND NOT (ct.origin ILIKE '%indica%' OR ct.origin ILIKE '%referral%')
      )
      OR (p_origin = 'organic' AND (c.referral_source IS NULL OR c.referral_source != 'meta_ads'))
    );

  -- Conversas atribuídas (no período)
  SELECT COUNT(*)::BIGINT
  INTO v_assigned_conversations
  FROM conversations c
  JOIN contacts ct ON ct.id = c.contact_id
  WHERE c.created_at >= p_date_from
    AND c.created_at < p_date_to
    AND c.assigned_to IS NOT NULL
    AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
    AND (p_department_id IS NULL OR c.department_id = p_department_id)
    AND (p_channel_id IS NULL OR c.channel_id = p_channel_id)
    AND (
      p_origin IS NULL OR p_origin = 'all'
      OR (p_origin = 'meta_ads' AND c.referral_source = 'meta_ads')
      OR (p_origin = 'linktree' AND c.referral_source = 'linktree')
      OR (p_origin = 'site' AND c.referral_source = 'site')
      OR (p_origin = 'manual' AND (ct.origin = 'manual' OR ct.origin = 'import'))
      OR (p_origin = 'referral' AND (ct.origin ILIKE '%indica%' OR ct.origin ILIKE '%referral%'))
      OR (p_origin = 'organic_unknown' AND (
          c.referral_source IS NULL OR c.referral_source NOT IN ('meta_ads', 'linktree', 'site')
        )
        AND NOT (ct.origin = 'manual' OR ct.origin = 'import')
        AND NOT (ct.origin ILIKE '%indica%' OR ct.origin ILIKE '%referral%')
      )
      OR (p_origin = 'organic' AND (c.referral_source IS NULL OR c.referral_source != 'meta_ads'))
    );

  SELECT json_build_object(
    'total_conversations', v_total_conversations,
    'assigned_conversations', v_assigned_conversations,
    'assignment_rate', CASE WHEN v_total_conversations > 0 THEN ROUND((v_assigned_conversations::NUMERIC / v_total_conversations::NUMERIC) * 100, 1) ELSE 0 END,

    'converted_leads', (
      SELECT COUNT(DISTINCT c.contact_id)
      FROM conversations c
      JOIN contacts ct ON ct.id = c.contact_id
      WHERE c.created_at >= p_date_from
        AND c.created_at < p_date_to
        AND c.lead_status IS NOT NULL
        AND c.lead_status = ANY(v_conversion_status_names)
        AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
        AND (p_department_id IS NULL OR c.department_id = p_department_id)
        AND (p_channel_id IS NULL OR c.channel_id = p_channel_id)
        AND (
          p_origin IS NULL OR p_origin = 'all'
          OR (p_origin = 'meta_ads' AND c.referral_source = 'meta_ads')
          OR (p_origin = 'linktree' AND c.referral_source = 'linktree')
          OR (p_origin = 'site' AND c.referral_source = 'site')
          OR (p_origin = 'manual' AND (ct.origin = 'manual' OR ct.origin = 'import'))
          OR (p_origin = 'referral' AND (ct.origin ILIKE '%indica%' OR ct.origin ILIKE '%referral%'))
          OR (p_origin = 'organic_unknown' AND (
              c.referral_source IS NULL OR c.referral_source NOT IN ('meta_ads', 'linktree', 'site')
            )
            AND NOT (ct.origin = 'manual' OR ct.origin = 'import')
            AND NOT (ct.origin ILIKE '%indica%' OR ct.origin ILIKE '%referral%')
          )
          OR (p_origin = 'organic' AND (c.referral_source IS NULL OR c.referral_source != 'meta_ads'))
        )
    ),

    'total_converted_value', (
      SELECT COALESCE(SUM(ct.negotiated_value), 0)
      FROM conversations c
      JOIN contacts ct ON ct.id = c.contact_id
      WHERE c.created_at >= p_date_from
        AND c.created_at < p_date_to
        AND c.lead_status IS NOT NULL
        AND c.lead_status = ANY(v_conversion_status_names)
        AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
        AND (p_department_id IS NULL OR c.department_id = p_department_id)
        AND (p_channel_id IS NULL OR c.channel_id = p_channel_id)
        AND (
          p_origin IS NULL OR p_origin = 'all'
          OR (p_origin = 'meta_ads' AND c.referral_source = 'meta_ads')
          OR (p_origin = 'linktree' AND c.referral_source = 'linktree')
          OR (p_origin = 'site' AND c.referral_source = 'site')
          OR (p_origin = 'manual' AND (ct.origin = 'manual' OR ct.origin = 'import'))
          OR (p_origin = 'referral' AND (ct.origin ILIKE '%indica%' OR ct.origin ILIKE '%referral%'))
          OR (p_origin = 'organic_unknown' AND (
              c.referral_source IS NULL OR c.referral_source NOT IN ('meta_ads', 'linktree', 'site')
            )
            AND NOT (ct.origin = 'manual' OR ct.origin = 'import')
            AND NOT (ct.origin ILIKE '%indica%' OR ct.origin ILIKE '%referral%')
          )
          OR (p_origin = 'organic' AND (c.referral_source IS NULL OR c.referral_source != 'meta_ads'))
        )
    ),

    'avg_first_response_seconds', (
      SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (c.first_response_at - c.created_at))), 0)
      FROM conversations c
      WHERE c.created_at >= p_date_from
        AND c.created_at < p_date_to
        AND c.first_response_at IS NOT NULL
        AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
        AND (p_department_id IS NULL OR c.department_id = p_department_id)
        AND (p_channel_id IS NULL OR c.channel_id = p_channel_id)
    )
  ) INTO result;

  RETURN result;
END;
$$;