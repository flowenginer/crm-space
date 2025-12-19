-- 1. Corrigir COUNT(*) na função get_returning_leads_metrics
CREATE OR REPLACE FUNCTION public.get_returning_leads_metrics(
  p_date_from timestamp with time zone, 
  p_date_to timestamp with time zone, 
  p_agent_id uuid DEFAULT NULL::uuid, 
  p_department_id uuid DEFAULT NULL::uuid, 
  p_channel_id uuid DEFAULT NULL::uuid,
  p_origin text DEFAULT NULL::text
)
RETURNS TABLE(
  total_conversations bigint, 
  new_contacts bigint, 
  returning_contacts bigint, 
  new_contact_rate numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH base_conversations AS (
    SELECT 
      c.id,
      c.contact_id,
      c.created_at,
      ct.first_contact_at
    FROM conversations c
    INNER JOIN contacts ct ON ct.id = c.contact_id
    WHERE c.created_at >= p_date_from
      AND c.created_at <= p_date_to
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
        ) AND NOT (ct.origin = 'manual' OR ct.origin = 'import')
          AND NOT (ct.origin ILIKE '%indica%' OR ct.origin ILIKE '%referral%'))
        OR (p_origin = 'organic' AND (c.referral_source IS NULL OR c.referral_source != 'meta_ads'))
      )
  ),
  new_unique_contacts AS (
    SELECT DISTINCT bc.contact_id
    FROM base_conversations bc
    WHERE bc.first_contact_at >= p_date_from
      AND bc.first_contact_at <= p_date_to
  ),
  returning_unique_contacts AS (
    SELECT DISTINCT bc.contact_id
    FROM base_conversations bc
    WHERE bc.first_contact_at < p_date_from
  )
  SELECT
    (SELECT COUNT(*) FROM base_conversations)::BIGINT as total_conversations,
    (SELECT COUNT(*) FROM new_unique_contacts)::BIGINT as new_contacts,
    (SELECT COUNT(*) FROM returning_unique_contacts)::BIGINT as returning_contacts,
    CASE 
      WHEN ((SELECT COUNT(*) FROM new_unique_contacts) + (SELECT COUNT(*) FROM returning_unique_contacts)) > 0 
      THEN ROUND(((SELECT COUNT(*) FROM new_unique_contacts)::NUMERIC / ((SELECT COUNT(*) FROM new_unique_contacts) + (SELECT COUNT(*) FROM returning_unique_contacts))::NUMERIC) * 100, 1)
      ELSE 0
    END as new_contact_rate;
END;
$function$;

-- 2. Criar trigger para preencher first_response_at automaticamente
CREATE OR REPLACE FUNCTION public.update_first_response_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Se é uma mensagem do atendente (is_from_me = true)
  IF NEW.is_from_me = true AND NEW.conversation_id IS NOT NULL THEN
    -- Atualizar first_response_at apenas se ainda for NULL
    UPDATE conversations
    SET first_response_at = NEW.created_at
    WHERE id = NEW.conversation_id
      AND first_response_at IS NULL;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Remover trigger se já existir
DROP TRIGGER IF EXISTS trigger_update_first_response_at ON messages;

-- Criar trigger
CREATE TRIGGER trigger_update_first_response_at
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION update_first_response_at();

-- 3. Corrigir dados históricos - preencher first_response_at para conversas que não têm
UPDATE conversations c
SET first_response_at = (
  SELECT MIN(m.created_at)
  FROM messages m
  WHERE m.conversation_id = c.id
    AND m.is_from_me = true
)
WHERE c.first_response_at IS NULL
  AND EXISTS (
    SELECT 1 FROM messages m 
    WHERE m.conversation_id = c.id 
    AND m.is_from_me = true
  );