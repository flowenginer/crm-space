-- Função para contar conversas ativas cujos contatos não têm nenhuma etiqueta
CREATE OR REPLACE FUNCTION get_no_tag_conversation_count(
  p_department_id uuid DEFAULT NULL,
  p_agent_id uuid DEFAULT NULL,
  p_channel_id uuid DEFAULT NULL,
  p_origin text DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result BIGINT;
BEGIN
  SELECT COUNT(DISTINCT c.id) INTO result
  FROM conversations c
  WHERE c.status IN ('open', 'pending')
    AND NOT EXISTS (
      SELECT 1 FROM contact_tags ct WHERE ct.contact_id = c.contact_id
    )
    AND (p_department_id IS NULL OR c.department_id = p_department_id)
    AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
    AND (p_channel_id IS NULL OR c.channel_id = p_channel_id)
    AND (p_origin IS NULL 
         OR (p_origin = 'meta_ads' AND c.referral_source = 'meta_ads')
         OR (p_origin = 'organic' AND (c.referral_source IS NULL OR c.referral_source != 'meta_ads')));
  
  RETURN COALESCE(result, 0);
END;
$$;