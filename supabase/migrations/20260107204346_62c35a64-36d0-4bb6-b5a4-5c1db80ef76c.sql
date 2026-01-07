-- Enable pg_trgm extension for fuzzy text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create GIN index for fast text search on messages content
CREATE INDEX IF NOT EXISTS idx_messages_content_trgm 
ON messages USING gin (content gin_trgm_ops)
WHERE content IS NOT NULL AND is_deleted IS NOT TRUE;

-- Create function for global message search
CREATE OR REPLACE FUNCTION search_messages_global(
  p_search_term text, 
  p_limit int DEFAULT 20
)
RETURNS TABLE(
  message_id uuid,
  conversation_id uuid,
  content text,
  created_at timestamptz,
  is_from_me boolean,
  contact_id uuid,
  contact_name text,
  contact_phone text,
  match_highlight text
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_tenant UUID;
BEGIN
  v_user_tenant := get_user_tenant_id();
  IF v_user_tenant IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT DISTINCT ON (m.conversation_id)
    m.id AS message_id,
    m.conversation_id,
    m.content,
    m.created_at,
    m.is_from_me,
    c.id AS contact_id,
    c.full_name AS contact_name,
    c.phone AS contact_phone,
    -- Extract snippet with match context (30 chars before, 80 total length)
    substring(m.content from greatest(1, position(lower(p_search_term) in lower(m.content)) - 30) for 80) AS match_highlight
  FROM messages m
  JOIN conversations conv ON conv.id = m.conversation_id
  JOIN contacts c ON c.id = conv.contact_id
  WHERE m.tenant_id = v_user_tenant
    AND m.is_deleted IS NOT TRUE
    AND m.content IS NOT NULL
    AND m.content ILIKE '%' || p_search_term || '%'
  ORDER BY m.conversation_id, m.created_at DESC
  LIMIT p_limit;
END;
$$;