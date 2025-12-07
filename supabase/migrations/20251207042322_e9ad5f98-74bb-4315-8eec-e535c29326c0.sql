-- Criar função RPC para contar etiquetas de conversas de forma eficiente
CREATE OR REPLACE FUNCTION get_conversation_tag_counts(
  p_department_id UUID DEFAULT NULL,
  p_agent_id UUID DEFAULT NULL,
  p_channel_id UUID DEFAULT NULL,
  p_origin TEXT DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_object_agg(tag_id::text, cnt), '{}'::json)
    FROM (
      SELECT ct.tag_id, COUNT(DISTINCT c.id) as cnt
      FROM conversations c
      INNER JOIN contact_tags ct ON ct.contact_id = c.contact_id
      WHERE c.status = 'open'
        AND (p_department_id IS NULL OR c.department_id = p_department_id)
        AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
        AND (p_channel_id IS NULL OR c.channel_id = p_channel_id)
        AND (p_origin IS NULL 
             OR (p_origin = 'meta_ads' AND c.referral_source = 'meta_ads')
             OR (p_origin = 'organic' AND (c.referral_source IS NULL OR c.referral_source != 'meta_ads')))
      GROUP BY ct.tag_id
    ) s
  );
END;
$$;