-- Add p_close_reason_ids parameter to bulk dispatch preview functions

-- Drop and recreate get_bulk_dispatch_preview_count with new parameter
DROP FUNCTION IF EXISTS get_bulk_dispatch_preview_count(UUID, TEXT[], INT, UUID[], TEXT[], UUID, TEXT, UUID[], UUID[], TEXT, BOOLEAN, TIMESTAMP, TIMESTAMP);

CREATE OR REPLACE FUNCTION get_bulk_dispatch_preview_count(
  p_tenant_id UUID,
  p_lead_status_names TEXT[] DEFAULT NULL,
  p_last_client_message_days_ago INT DEFAULT NULL,
  p_tag_ids UUID[] DEFAULT NULL,
  p_conversation_statuses TEXT[] DEFAULT NULL,
  p_segment_id UUID DEFAULT NULL,
  p_origin TEXT DEFAULT NULL,
  p_assigned_to UUID[] DEFAULT NULL,
  p_department_ids UUID[] DEFAULT NULL,
  p_contact_type TEXT DEFAULT NULL,
  p_include_blocked BOOLEAN DEFAULT FALSE,
  p_first_contact_start TIMESTAMP DEFAULT NULL,
  p_first_contact_end TIMESTAMP DEFAULT NULL,
  p_close_reason_ids UUID[] DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE SQL STABLE
AS $$
  SELECT COUNT(DISTINCT c.id)
  FROM contacts c
  WHERE c.tenant_id = p_tenant_id
    AND (p_include_blocked OR COALESCE(c.is_blocked, false) = false)
    AND (p_lead_status_names IS NULL OR c.lead_status = ANY(p_lead_status_names))
    AND (p_segment_id IS NULL OR c.segment_id = p_segment_id)
    AND (p_origin IS NULL OR c.origin = p_origin)
    AND (p_assigned_to IS NULL OR c.assigned_to = ANY(p_assigned_to))
    AND (p_department_ids IS NULL OR c.department_id = ANY(p_department_ids))
    AND (p_contact_type IS NULL OR c.contact_type = p_contact_type)
    AND (p_first_contact_start IS NULL OR c.first_contact_at >= p_first_contact_start)
    AND (p_first_contact_end IS NULL OR c.first_contact_at <= p_first_contact_end)
    AND (p_tag_ids IS NULL OR EXISTS (
      SELECT 1 FROM contact_tags ct WHERE ct.contact_id = c.id AND ct.tag_id = ANY(p_tag_ids)
    ))
    AND (p_conversation_statuses IS NULL OR EXISTS (
      SELECT 1 FROM conversations conv WHERE conv.contact_id = c.id AND conv.status = ANY(p_conversation_statuses)
    ))
    AND (p_last_client_message_days_ago IS NULL OR (
      NOT EXISTS (
        SELECT 1 FROM conversations conv
        JOIN messages m ON m.conversation_id = conv.id
        WHERE conv.contact_id = c.id AND m.is_from_me = false
      )
      OR (
        SELECT MAX(m.created_at)
        FROM conversations conv
        JOIN messages m ON m.conversation_id = conv.id
        WHERE conv.contact_id = c.id AND m.is_from_me = false
      ) < NOW() - (p_last_client_message_days_ago || ' days')::INTERVAL
    ))
    -- Filtro de motivo de fechamento
    AND (p_close_reason_ids IS NULL OR EXISTS (
      SELECT 1 FROM conversations conv
      JOIN close_reasons cr ON cr.name = conv.close_reason AND cr.tenant_id = conv.tenant_id
      WHERE conv.contact_id = c.id 
        AND cr.id = ANY(p_close_reason_ids)
    ))
$$;

-- Drop and recreate get_bulk_dispatch_preview_contacts with new parameter
DROP FUNCTION IF EXISTS get_bulk_dispatch_preview_contacts(UUID, TEXT[], INT, UUID[], TEXT[], UUID, TEXT, UUID[], UUID[], TEXT, BOOLEAN, TIMESTAMP, TIMESTAMP, INT, INT);

CREATE OR REPLACE FUNCTION get_bulk_dispatch_preview_contacts(
  p_tenant_id UUID,
  p_lead_status_names TEXT[] DEFAULT NULL,
  p_last_client_message_days_ago INT DEFAULT NULL,
  p_tag_ids UUID[] DEFAULT NULL,
  p_conversation_statuses TEXT[] DEFAULT NULL,
  p_segment_id UUID DEFAULT NULL,
  p_origin TEXT DEFAULT NULL,
  p_assigned_to UUID[] DEFAULT NULL,
  p_department_ids UUID[] DEFAULT NULL,
  p_contact_type TEXT DEFAULT NULL,
  p_include_blocked BOOLEAN DEFAULT FALSE,
  p_first_contact_start TIMESTAMP DEFAULT NULL,
  p_first_contact_end TIMESTAMP DEFAULT NULL,
  p_close_reason_ids UUID[] DEFAULT NULL,
  p_offset_val INT DEFAULT 0,
  p_limit_val INT DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  lead_status TEXT,
  last_interaction_at TIMESTAMPTZ
)
LANGUAGE SQL STABLE
AS $$
  SELECT DISTINCT
    c.id,
    c.full_name,
    c.phone,
    c.avatar_url,
    c.lead_status,
    c.last_interaction_at
  FROM contacts c
  WHERE c.tenant_id = p_tenant_id
    AND (p_include_blocked OR COALESCE(c.is_blocked, false) = false)
    AND (p_lead_status_names IS NULL OR c.lead_status = ANY(p_lead_status_names))
    AND (p_segment_id IS NULL OR c.segment_id = p_segment_id)
    AND (p_origin IS NULL OR c.origin = p_origin)
    AND (p_assigned_to IS NULL OR c.assigned_to = ANY(p_assigned_to))
    AND (p_department_ids IS NULL OR c.department_id = ANY(p_department_ids))
    AND (p_contact_type IS NULL OR c.contact_type = p_contact_type)
    AND (p_first_contact_start IS NULL OR c.first_contact_at >= p_first_contact_start)
    AND (p_first_contact_end IS NULL OR c.first_contact_at <= p_first_contact_end)
    AND (p_tag_ids IS NULL OR EXISTS (
      SELECT 1 FROM contact_tags ct WHERE ct.contact_id = c.id AND ct.tag_id = ANY(p_tag_ids)
    ))
    AND (p_conversation_statuses IS NULL OR EXISTS (
      SELECT 1 FROM conversations conv WHERE conv.contact_id = c.id AND conv.status = ANY(p_conversation_statuses)
    ))
    AND (p_last_client_message_days_ago IS NULL OR (
      NOT EXISTS (
        SELECT 1 FROM conversations conv
        JOIN messages m ON m.conversation_id = conv.id
        WHERE conv.contact_id = c.id AND m.is_from_me = false
      )
      OR (
        SELECT MAX(m.created_at)
        FROM conversations conv
        JOIN messages m ON m.conversation_id = conv.id
        WHERE conv.contact_id = c.id AND m.is_from_me = false
      ) < NOW() - (p_last_client_message_days_ago || ' days')::INTERVAL
    ))
    -- Filtro de motivo de fechamento
    AND (p_close_reason_ids IS NULL OR EXISTS (
      SELECT 1 FROM conversations conv
      JOIN close_reasons cr ON cr.name = conv.close_reason AND cr.tenant_id = conv.tenant_id
      WHERE conv.contact_id = c.id 
        AND cr.id = ANY(p_close_reason_ids)
    ))
  ORDER BY c.full_name ASC
  OFFSET p_offset_val
  LIMIT p_limit_val
$$;