-- Função RPC para retornar contagens e valores agregados por lead status
-- Busca COUNT e SUM diretamente do banco (números reais, não da pré-visualização)
CREATE OR REPLACE FUNCTION get_lead_status_summary()
RETURNS TABLE(
  lead_status TEXT,
  contact_count BIGINT,
  total_value NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(c.lead_status, '__no_status__') as lead_status,
    COUNT(*)::BIGINT as contact_count,
    COALESCE(SUM(c.negotiated_value), 0)::NUMERIC as total_value
  FROM contacts c
  GROUP BY c.lead_status
  ORDER BY contact_count DESC;
END;
$$;