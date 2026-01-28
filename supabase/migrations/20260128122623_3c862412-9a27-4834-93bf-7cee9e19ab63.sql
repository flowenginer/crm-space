-- Adicionar campo shirt_quantity (quantidade de camisas) na tabela contacts
ALTER TABLE public.contacts
ADD COLUMN IF NOT EXISTS shirt_quantity integer DEFAULT 0;

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_contacts_shirt_quantity ON public.contacts(shirt_quantity) WHERE shirt_quantity > 0;

-- Criar função RPC para inteligência de leads por estado/segmento
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
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  SELECT get_user_tenant_id() INTO v_tenant_id;

  RETURN QUERY
  WITH lead_data AS (
    SELECT 
      c.id as contact_id,
      -- Extrair estado do DDD (posição 3-4 do telefone que começa com 55)
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
      -- Extrair headline da campanha do referral_data
      COALESCE(
        conv.referral_data->>'headline',
        CASE 
          WHEN c.origin IN ('meta_ads', 'ctwa_ad') THEN 'Meta Ads'
          ELSE 'Orgânico'
        END
      ) as lead_campaign,
      c.lead_status,
      c.negotiated_value,
      COALESCE(c.shirt_quantity, 0) as lead_shirts
    FROM contacts c
    LEFT JOIN segments s ON s.id = c.segment_id
    LEFT JOIN LATERAL (
      SELECT referral_data
      FROM conversations conv2
      WHERE conv2.contact_id = c.id
        AND conv2.referral_data IS NOT NULL
      ORDER BY conv2.created_at ASC
      LIMIT 1
    ) conv ON true
    WHERE c.tenant_id = v_tenant_id
      AND c.created_at >= p_date_from
      AND c.created_at <= p_date_to
      AND (p_state IS NULL OR 
        CASE 
          WHEN c.phone LIKE '55%' AND LENGTH(c.phone) >= 12 THEN
            CASE SUBSTRING(c.phone FROM 3 FOR 2)
              WHEN '11' THEN 'SP' WHEN '12' THEN 'SP' WHEN '13' THEN 'SP' 
              WHEN '14' THEN 'SP' WHEN '15' THEN 'SP' WHEN '16' THEN 'SP' 
              WHEN '17' THEN 'SP' WHEN '18' THEN 'SP' WHEN '19' THEN 'SP'
              WHEN '21' THEN 'RJ' WHEN '22' THEN 'RJ' WHEN '24' THEN 'RJ'
              WHEN '27' THEN 'ES' WHEN '28' THEN 'ES'
              WHEN '31' THEN 'MG' WHEN '32' THEN 'MG' WHEN '33' THEN 'MG' 
              WHEN '34' THEN 'MG' WHEN '35' THEN 'MG' WHEN '37' THEN 'MG' WHEN '38' THEN 'MG'
              WHEN '41' THEN 'PR' WHEN '42' THEN 'PR' WHEN '43' THEN 'PR' 
              WHEN '44' THEN 'PR' WHEN '45' THEN 'PR' WHEN '46' THEN 'PR'
              WHEN '47' THEN 'SC' WHEN '48' THEN 'SC' WHEN '49' THEN 'SC'
              WHEN '51' THEN 'RS' WHEN '53' THEN 'RS' WHEN '54' THEN 'RS' WHEN '55' THEN 'RS'
              WHEN '61' THEN 'DF' WHEN '62' THEN 'GO' WHEN '64' THEN 'GO' 
              WHEN '63' THEN 'TO' WHEN '65' THEN 'MT' WHEN '66' THEN 'MT' WHEN '67' THEN 'MS'
              WHEN '68' THEN 'AC' WHEN '69' THEN 'RO' WHEN '91' THEN 'PA' 
              WHEN '93' THEN 'PA' WHEN '94' THEN 'PA' WHEN '92' THEN 'AM' 
              WHEN '97' THEN 'AM' WHEN '95' THEN 'RR' WHEN '96' THEN 'AP'
              WHEN '71' THEN 'BA' WHEN '73' THEN 'BA' WHEN '74' THEN 'BA' 
              WHEN '75' THEN 'BA' WHEN '77' THEN 'BA' WHEN '79' THEN 'SE'
              WHEN '81' THEN 'PE' WHEN '87' THEN 'PE' WHEN '82' THEN 'AL' 
              WHEN '83' THEN 'PB' WHEN '84' THEN 'RN' WHEN '85' THEN 'CE' 
              WHEN '88' THEN 'CE' WHEN '86' THEN 'PI' WHEN '89' THEN 'PI'
              WHEN '98' THEN 'MA' WHEN '99' THEN 'MA'
              ELSE 'Outro'
            END
          ELSE 'Outro'
        END = p_state
      )
      AND (p_segment_id IS NULL OR c.segment_id = p_segment_id)
  )
  SELECT 
    ld.lead_state as state,
    ld.lead_segment_id as segment_id,
    COALESCE(ld.lead_segment_name, 'Sem Segmento') as segment_name,
    ld.lead_campaign as campaign,
    COUNT(DISTINCT ld.contact_id) as total_leads,
    COUNT(DISTINCT ld.contact_id) FILTER (
      WHERE ld.lead_status LIKE '%07 - Pedido Fechado%'
    ) as converted_leads,
    COALESCE(SUM(ld.negotiated_value) FILTER (
      WHERE ld.lead_status LIKE '%07 - Pedido Fechado%'
    ), 0) as total_revenue,
    COALESCE(SUM(ld.lead_shirts), 0) as total_shirts,
    ROUND(
      CASE 
        WHEN COUNT(DISTINCT ld.contact_id) FILTER (WHERE ld.lead_status LIKE '%07 - Pedido Fechado%') > 0 
        THEN COALESCE(SUM(ld.negotiated_value) FILTER (WHERE ld.lead_status LIKE '%07 - Pedido Fechado%'), 0) / 
             COUNT(DISTINCT ld.contact_id) FILTER (WHERE ld.lead_status LIKE '%07 - Pedido Fechado%')
        ELSE 0
      END, 2
    ) as avg_ticket,
    ROUND(
      CASE 
        WHEN COUNT(DISTINCT ld.contact_id) > 0 
        THEN (COUNT(DISTINCT ld.contact_id) FILTER (WHERE ld.lead_status LIKE '%07 - Pedido Fechado%')::numeric / 
              COUNT(DISTINCT ld.contact_id)::numeric * 100)
        ELSE 0
      END, 2
    ) as conversion_rate
  FROM lead_data ld
  GROUP BY ld.lead_state, ld.lead_segment_id, ld.lead_segment_name, ld.lead_campaign
  ORDER BY total_leads DESC;
END;
$$;

-- Função auxiliar para resumo por estado
CREATE OR REPLACE FUNCTION public.get_lead_intelligence_by_state(
  p_date_from timestamp with time zone,
  p_date_to timestamp with time zone
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
  SELECT get_user_tenant_id() INTO v_tenant_id;

  RETURN QUERY
  SELECT 
    li.state,
    SUM(li.total_leads) as total_leads,
    SUM(li.converted_leads) as converted_leads,
    SUM(li.total_revenue) as total_revenue,
    ROUND(CASE WHEN SUM(li.converted_leads) > 0 THEN SUM(li.total_revenue) / SUM(li.converted_leads) ELSE 0 END, 2) as avg_ticket,
    ROUND(CASE WHEN SUM(li.total_leads) > 0 THEN (SUM(li.converted_leads)::numeric / SUM(li.total_leads)::numeric * 100) ELSE 0 END, 2) as conversion_rate
  FROM get_lead_intelligence(p_date_from, p_date_to) li
  GROUP BY li.state
  ORDER BY total_leads DESC;
END;
$$;

-- Função auxiliar para resumo por segmento
CREATE OR REPLACE FUNCTION public.get_lead_intelligence_by_segment(
  p_date_from timestamp with time zone,
  p_date_to timestamp with time zone,
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
BEGIN
  RETURN QUERY
  SELECT 
    li.segment_id,
    li.segment_name,
    SUM(li.total_leads)::bigint as total_leads,
    SUM(li.converted_leads)::bigint as converted_leads,
    SUM(li.total_revenue) as total_revenue,
    ROUND(CASE WHEN SUM(li.converted_leads) > 0 THEN SUM(li.total_revenue) / SUM(li.converted_leads) ELSE 0 END, 2) as avg_ticket,
    ROUND(CASE WHEN SUM(li.total_leads) > 0 THEN (SUM(li.converted_leads)::numeric / SUM(li.total_leads)::numeric * 100) ELSE 0 END, 2) as conversion_rate
  FROM get_lead_intelligence(p_date_from, p_date_to, p_state) li
  GROUP BY li.segment_id, li.segment_name
  ORDER BY total_leads DESC;
END;
$$;