-- Align Lead Intelligence metrics with Dashboard logic:
-- - Base leads on contacts that had conversations started in the period (conversations.created_at)
-- - Keep conversions based on lead_status_history transitions in the period (dynamic company_settings.conversion_status_ids)
-- - Revenue = sum of contacts.negotiated_value for converted contacts (same contact set as conversions)

CREATE OR REPLACE FUNCTION public.get_lead_intelligence(
  p_date_from timestamp with time zone,
  p_date_to timestamp with time zone,
  p_state text DEFAULT NULL,
  p_segment_id uuid DEFAULT NULL,
  p_campaign text DEFAULT NULL
)
RETURNS TABLE(
  state text,
  segment_id uuid,
  segment_name text,
  campaign text,
  total_leads bigint,
  converted_leads bigint,
  total_revenue numeric,
  total_shirts bigint,
  avg_ticket numeric,
  conversion_rate numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id uuid;
BEGIN
  SELECT get_user_tenant_id() INTO v_tenant_id;

  RETURN QUERY
  WITH conversion_status_ids AS (
    SELECT unnest(cs.conversion_status_ids) as status_id
    FROM company_settings cs
    WHERE cs.tenant_id = v_tenant_id
  ),
  conversion_status_names AS (
    SELECT ls.name
    FROM lead_statuses ls
    WHERE ls.tenant_id = v_tenant_id
      AND ls.id IN (SELECT status_id FROM conversion_status_ids)
  ),
  converted_contacts AS (
    SELECT DISTINCT lsh.contact_id
    FROM lead_status_history lsh
    WHERE lsh.tenant_id = v_tenant_id
      AND lsh.new_status IN (SELECT name FROM conversion_status_names)
      AND lsh.changed_at >= p_date_from
      AND lsh.changed_at <= p_date_to
  ),
  period_contacts AS (
    -- Lead base = contacts that had at least one conversation created in the period
    SELECT DISTINCT cv.contact_id
    FROM conversations cv
    WHERE cv.tenant_id = v_tenant_id
      AND cv.created_at >= p_date_from
      AND cv.created_at <= p_date_to
  ),
  lead_data AS (
    SELECT 
      c.id as contact_id,
      -- State derived from DDD
      CASE 
        WHEN c.phone LIKE '55%' AND LENGTH(c.phone) >= 12 THEN
          CASE SUBSTRING(c.phone FROM 3 FOR 2)
            -- São Paulo
            WHEN '11' THEN 'SP' WHEN '12' THEN 'SP' WHEN '13' THEN 'SP'
            WHEN '14' THEN 'SP' WHEN '15' THEN 'SP' WHEN '16' THEN 'SP'
            WHEN '17' THEN 'SP' WHEN '18' THEN 'SP' WHEN '19' THEN 'SP'
            -- Rio de Janeiro
            WHEN '21' THEN 'RJ' WHEN '22' THEN 'RJ' WHEN '24' THEN 'RJ'
            -- Espírito Santo
            WHEN '27' THEN 'ES' WHEN '28' THEN 'ES'
            -- Minas Gerais
            WHEN '31' THEN 'MG' WHEN '32' THEN 'MG' WHEN '33' THEN 'MG'
            WHEN '34' THEN 'MG' WHEN '35' THEN 'MG' WHEN '37' THEN 'MG' WHEN '38' THEN 'MG'
            -- Paraná
            WHEN '41' THEN 'PR' WHEN '42' THEN 'PR' WHEN '43' THEN 'PR'
            WHEN '44' THEN 'PR' WHEN '45' THEN 'PR' WHEN '46' THEN 'PR'
            -- Santa Catarina
            WHEN '47' THEN 'SC' WHEN '48' THEN 'SC' WHEN '49' THEN 'SC'
            -- Rio Grande do Sul
            WHEN '51' THEN 'RS' WHEN '53' THEN 'RS' WHEN '54' THEN 'RS' WHEN '55' THEN 'RS'
            -- Centro-Oeste
            WHEN '61' THEN 'DF' WHEN '62' THEN 'GO' WHEN '64' THEN 'GO'
            WHEN '63' THEN 'TO' WHEN '65' THEN 'MT' WHEN '66' THEN 'MT' WHEN '67' THEN 'MS'
            -- Norte
            WHEN '68' THEN 'AC' WHEN '69' THEN 'RO' WHEN '91' THEN 'PA'
            WHEN '93' THEN 'PA' WHEN '94' THEN 'PA' WHEN '92' THEN 'AM'
            WHEN '97' THEN 'AM' WHEN '95' THEN 'RR' WHEN '96' THEN 'AP'
            -- Nordeste
            WHEN '71' THEN 'BA' WHEN '73' THEN 'BA' WHEN '74' THEN 'BA'
            WHEN '75' THEN 'BA' WHEN '77' THEN 'BA' WHEN '79' THEN 'SE'
            WHEN '81' THEN 'PE' WHEN '87' THEN 'PE' WHEN '82' THEN 'AL'
            WHEN '83' THEN 'PB' WHEN '84' THEN 'RN' WHEN '85' THEN 'CE'
            WHEN '88' THEN 'CE' WHEN '86' THEN 'PI' WHEN '89' THEN 'PI'
            WHEN '98' THEN 'MA' WHEN '99' THEN 'MA'
            ELSE 'Outro'
          END
        ELSE 'Outro'
      END as lead_state,
      c.segment_id as lead_segment_id,
      s.name as lead_segment_name,
      COALESCE(
        conv.referral_data->>'headline',
        CASE
          WHEN c.origin IN ('meta_ads', 'ctwa_ad') THEN 'Meta Ads'
          ELSE 'Orgânico'
        END
      ) as lead_campaign,
      (cc.contact_id IS NOT NULL) as is_converted,
      COALESCE(c.negotiated_value, 0) as negotiated_value,
      COALESCE(c.shirt_quantity, 0) as lead_shirts
    FROM period_contacts pc
    INNER JOIN contacts c ON c.id = pc.contact_id AND c.tenant_id = v_tenant_id
    LEFT JOIN segments s ON s.id = c.segment_id
    LEFT JOIN converted_contacts cc ON cc.contact_id = c.id
    LEFT JOIN LATERAL (
      SELECT cv2.referral_data
      FROM conversations cv2
      WHERE cv2.tenant_id = v_tenant_id
        AND cv2.contact_id = c.id
        AND cv2.referral_data IS NOT NULL
      ORDER BY cv2.created_at ASC
      LIMIT 1
    ) conv ON true
  )
  SELECT
    ld.lead_state as state,
    ld.lead_segment_id as segment_id,
    COALESCE(ld.lead_segment_name, 'Sem Segmento') as segment_name,
    ld.lead_campaign as campaign,
    COUNT(DISTINCT ld.contact_id) as total_leads,
    COUNT(DISTINCT ld.contact_id) FILTER (WHERE ld.is_converted = true) as converted_leads,
    COALESCE(SUM(ld.negotiated_value) FILTER (WHERE ld.is_converted = true), 0) as total_revenue,
    COALESCE(SUM(ld.lead_shirts), 0) as total_shirts,
    ROUND(
      CASE
        WHEN COUNT(DISTINCT ld.contact_id) FILTER (WHERE ld.is_converted = true) > 0
        THEN COALESCE(SUM(ld.negotiated_value) FILTER (WHERE ld.is_converted = true), 0) /
             COUNT(DISTINCT ld.contact_id) FILTER (WHERE ld.is_converted = true)
        ELSE 0
      END,
      2
    ) as avg_ticket,
    ROUND(
      CASE
        WHEN COUNT(DISTINCT ld.contact_id) > 0
        THEN (COUNT(DISTINCT ld.contact_id) FILTER (WHERE ld.is_converted = true)::numeric /
              COUNT(DISTINCT ld.contact_id)::numeric * 100)
        ELSE 0
      END,
      2
    ) as conversion_rate
  FROM lead_data ld
  WHERE (p_state IS NULL OR ld.lead_state = p_state)
    AND (p_segment_id IS NULL OR ld.lead_segment_id = p_segment_id)
    AND (p_campaign IS NULL OR ld.lead_campaign = p_campaign)
  GROUP BY ld.lead_state, ld.lead_segment_id, ld.lead_segment_name, ld.lead_campaign
  ORDER BY total_leads DESC;
END;
$function$;