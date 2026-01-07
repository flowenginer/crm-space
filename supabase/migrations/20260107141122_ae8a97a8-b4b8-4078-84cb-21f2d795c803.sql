-- Função para obter contatos que não enviaram mensagem há X dias
CREATE OR REPLACE FUNCTION get_contacts_last_client_message_before(
  p_days_ago INTEGER,
  p_tenant_id UUID
)
RETURNS TABLE (contact_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT c.id as contact_id
  FROM contacts c
  WHERE c.tenant_id = p_tenant_id
    AND (
      -- Contatos sem nenhuma mensagem recebida
      NOT EXISTS (
        SELECT 1 FROM conversations conv
        JOIN messages m ON m.conversation_id = conv.id
        WHERE conv.contact_id = c.id 
          AND m.is_from_me = false
      )
      OR
      -- Contatos cuja última mensagem recebida foi há mais de X dias
      (
        SELECT MAX(m.created_at)
        FROM conversations conv
        JOIN messages m ON m.conversation_id = conv.id
        WHERE conv.contact_id = c.id 
          AND m.is_from_me = false
      ) < NOW() - (p_days_ago || ' days')::INTERVAL
    )
$$;