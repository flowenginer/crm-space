
-- Fix tenant isolation for all RPC functions

-- 1. get_returning_leads_metrics - Principal função de KPIs da dashboard
DROP FUNCTION IF EXISTS get_returning_leads_metrics(timestamp with time zone, timestamp with time zone, uuid, uuid, uuid, text);

CREATE OR REPLACE FUNCTION get_returning_leads_metrics(
  p_date_from timestamp with time zone,
  p_date_to timestamp with time zone,
  p_agent_id uuid DEFAULT NULL,
  p_department_id uuid DEFAULT NULL,
  p_channel_id uuid DEFAULT NULL,
  p_origin text DEFAULT NULL
)
RETURNS TABLE(
  total_conversations bigint,
  new_contacts bigint,
  returning_contacts bigint,
  new_contact_rate numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  v_tenant_id := get_user_tenant_id();
  
  RETURN QUERY
  WITH base_conversations AS (
    SELECT 
      c.id,
      c.contact_id,
      c.created_at,
      ct.first_contact_at
    FROM conversations c
    INNER JOIN contacts ct ON ct.id = c.contact_id
    WHERE c.tenant_id = v_tenant_id
      AND ct.tenant_id = v_tenant_id
      AND c.created_at >= p_date_from
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
$$;

-- 2. get_leads_distribution_by_agent - Distribuição por agente
DROP FUNCTION IF EXISTS get_leads_distribution_by_agent(timestamp with time zone, timestamp with time zone, text);

CREATE OR REPLACE FUNCTION get_leads_distribution_by_agent(
  p_date_from timestamp with time zone,
  p_date_to timestamp with time zone,
  p_origin text DEFAULT NULL
)
RETURNS TABLE(
  agent_id uuid,
  agent_name text,
  agent_avatar text,
  lead_count bigint,
  converted_count bigint,
  conversion_rate numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  v_tenant_id := get_user_tenant_id();
  
  RETURN QUERY
  WITH contact_with_agent AS (
    SELECT DISTINCT ON (ct.id)
      ct.id as contact_id,
      cv.assigned_to as contact_agent_id,
      ct.lead_status,
      ct.origin as contact_origin,
      CASE
        WHEN cv.referral_source = 'meta_ads' THEN 'meta_ads'
        WHEN cv.referral_source = 'linktree' THEN 'linktree'
        WHEN cv.referral_source = 'site' THEN 'site'
        WHEN ct.origin ILIKE '%indica%' OR ct.origin ILIKE '%referral%' THEN 'referral'
        WHEN ct.origin = 'manual' OR ct.origin = 'import' THEN 'manual'
        ELSE 'organic_unknown'
      END as detected_origin
    FROM contacts ct
    INNER JOIN conversations cv ON cv.contact_id = ct.id
    WHERE ct.tenant_id = v_tenant_id
      AND cv.tenant_id = v_tenant_id
      AND cv.created_at >= p_date_from
      AND cv.created_at <= p_date_to
    ORDER BY ct.id, cv.created_at DESC NULLS LAST
  ),
  filtered_contacts AS (
    SELECT 
      cwa.contact_id, 
      cwa.contact_agent_id, 
      cwa.lead_status, 
      cwa.detected_origin
    FROM contact_with_agent cwa
    WHERE cwa.contact_agent_id IS NOT NULL
      AND (p_origin IS NULL OR cwa.detected_origin = p_origin)
  )
  SELECT
    pr.id as agent_id,
    pr.full_name as agent_name,
    pr.avatar_url as agent_avatar,
    COUNT(fc.contact_id)::BIGINT as lead_count,
    COUNT(fc.contact_id) FILTER (
      WHERE fc.lead_status IN ('Convertido', 'Fechado', 'Ganho', 'Won', 'Venda', '07 - Pedido Fechado')
    )::BIGINT as converted_count,
    CASE 
      WHEN COUNT(fc.contact_id) > 0 
      THEN ROUND(
        (COUNT(*) FILTER (WHERE fc.lead_status IN ('Convertido', 'Fechado', 'Ganho', 'Won', 'Venda', '07 - Pedido Fechado'))::NUMERIC 
        / COUNT(*)::NUMERIC) * 100, 1
      )
      ELSE 0
    END as conversion_rate
  FROM profiles pr
  INNER JOIN filtered_contacts fc ON fc.contact_agent_id = pr.id
  WHERE pr.is_active = true
    AND pr.tenant_id = v_tenant_id
  GROUP BY pr.id, pr.full_name, pr.avatar_url
  ORDER BY COUNT(fc.contact_id) DESC;
END;
$$;

-- 3. get_lead_status_summary - Resumo de leads por status
DROP FUNCTION IF EXISTS get_lead_status_summary(uuid);

CREATE OR REPLACE FUNCTION get_lead_status_summary(_user_id uuid DEFAULT NULL)
RETURNS TABLE(
  lead_status text,
  contact_count bigint,
  total_value numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  v_tenant_id := get_user_tenant_id();
  
  -- Se não passou user_id ou é admin/supervisor, retorna todos do tenant
  IF _user_id IS NULL OR can_view_all_data(_user_id) THEN
    RETURN QUERY
    SELECT 
      COALESCE(c.lead_status, '__no_status__') as lead_status,
      COUNT(*)::BIGINT as contact_count,
      COALESCE(SUM(c.negotiated_value), 0)::NUMERIC as total_value
    FROM contacts c
    WHERE c.tenant_id = v_tenant_id
      AND EXISTS (
        SELECT 1 FROM conversations conv 
        WHERE conv.contact_id = c.id 
        AND conv.tenant_id = v_tenant_id
        AND conv.status IN ('open', 'pending')
      )
    GROUP BY c.lead_status
    ORDER BY contact_count DESC;
  ELSE
    -- Usuário comum: só vê contacts atribuídos a ele do tenant
    RETURN QUERY
    SELECT 
      COALESCE(c.lead_status, '__no_status__') as lead_status,
      COUNT(*)::BIGINT as contact_count,
      COALESCE(SUM(c.negotiated_value), 0)::NUMERIC as total_value
    FROM contacts c
    WHERE c.tenant_id = v_tenant_id
      AND c.assigned_to = _user_id
      AND EXISTS (
        SELECT 1 FROM conversations conv 
        WHERE conv.contact_id = c.id 
        AND conv.tenant_id = v_tenant_id
        AND conv.status IN ('open', 'pending')
      )
    GROUP BY c.lead_status
    ORDER BY contact_count DESC;
  END IF;
END;
$$;

-- 4. get_kanban_contacts_optimized - Kanban do CRM
DROP FUNCTION IF EXISTS get_kanban_contacts_optimized(uuid, integer);

CREATE OR REPLACE FUNCTION get_kanban_contacts_optimized(
  _user_id uuid,
  _limit_per_status integer DEFAULT 50
)
RETURNS TABLE(
  contact_id uuid,
  full_name text,
  phone text,
  email text,
  avatar_url text,
  lead_status text,
  negotiated_value numeric,
  assigned_to uuid,
  assignee_id uuid,
  assignee_name text,
  assignee_avatar text,
  updated_at timestamp with time zone,
  unread_count integer,
  conversation_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_role text;
  is_admin_user boolean;
  v_tenant_id uuid;
BEGIN
  v_tenant_id := get_user_tenant_id();
  
  -- Get user role
  SELECT role INTO _user_role
  FROM profiles
  WHERE profiles.id = _user_id AND profiles.tenant_id = v_tenant_id;

  -- Check if admin/supervisor
  is_admin_user := _user_role IN ('admin', 'super_admin', 'supervisor');

  RETURN QUERY
  WITH ranked_contacts AS (
    SELECT 
      c.id as contact_id,
      c.full_name,
      c.phone,
      c.email,
      c.avatar_url,
      c.lead_status,
      c.negotiated_value,
      c.assigned_to,
      p.id as assignee_id,
      p.full_name as assignee_name,
      p.avatar_url as assignee_avatar,
      c.updated_at,
      COALESCE((
        SELECT SUM(cv.unread_count)::integer 
        FROM conversations cv 
        WHERE cv.contact_id = c.id AND cv.tenant_id = v_tenant_id
      ), 0) as unread_count,
      (
        SELECT cv.id 
        FROM conversations cv 
        WHERE cv.contact_id = c.id AND cv.tenant_id = v_tenant_id
        ORDER BY cv.last_message_at DESC NULLS LAST 
        LIMIT 1
      ) as conversation_id,
      ROW_NUMBER() OVER (
        PARTITION BY COALESCE(c.lead_status, '__no_status__')
        ORDER BY c.updated_at DESC NULLS LAST
      ) as rn
    FROM contacts c
    LEFT JOIN profiles p ON p.id = c.assigned_to
    WHERE c.tenant_id = v_tenant_id
      AND (
        -- Admins veem tudo do tenant
        is_admin_user 
        -- Contato atribuído diretamente ao usuário
        OR c.assigned_to = _user_id
        -- Usuário tem conversa atribuída a ele com este contato
        OR EXISTS (
          SELECT 1 FROM conversations cv
          WHERE cv.contact_id = c.id
          AND cv.tenant_id = v_tenant_id
          AND cv.status IN ('open', 'pending')
          AND cv.assigned_to = _user_id
        )
      )
  )
  SELECT 
    rc.contact_id,
    rc.full_name,
    rc.phone,
    rc.email,
    rc.avatar_url,
    rc.lead_status,
    rc.negotiated_value,
    rc.assigned_to,
    rc.assignee_id,
    rc.assignee_name,
    rc.assignee_avatar,
    rc.updated_at,
    rc.unread_count,
    rc.conversation_id
  FROM ranked_contacts rc
  WHERE rc.rn <= _limit_per_status;
END;
$$;

-- 5. get_conversations_by_tags - Conversas por tags
DROP FUNCTION IF EXISTS get_conversations_by_tags(uuid[], boolean, uuid, uuid, uuid, text, integer, integer);

CREATE OR REPLACE FUNCTION get_conversations_by_tags(
  p_tag_ids uuid[],
  p_exclude_no_tags boolean DEFAULT false,
  p_department_id uuid DEFAULT NULL,
  p_agent_id uuid DEFAULT NULL,
  p_channel_id uuid DEFAULT NULL,
  p_origin text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  conversation_id uuid,
  contact_id uuid,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total BIGINT;
  v_tenant_id uuid;
BEGIN
  v_tenant_id := get_user_tenant_id();
  
  -- Count total first
  IF array_length(p_tag_ids, 1) > 0 THEN
    SELECT COUNT(DISTINCT c.id) INTO v_total
    FROM conversations c
    INNER JOIN contact_tags ct ON ct.contact_id = c.contact_id
    WHERE c.tenant_id = v_tenant_id
      AND ct.tenant_id = v_tenant_id
      AND c.status IN ('open', 'pending')
      AND ct.tag_id = ANY(p_tag_ids)
      AND (p_department_id IS NULL OR c.department_id = p_department_id)
      AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
      AND (p_channel_id IS NULL OR c.channel_id = p_channel_id)
      AND (p_origin IS NULL OR 
           (p_origin = 'meta_ads' AND c.referral_source = 'meta_ads') OR
           (p_origin = 'organic' AND (c.referral_source IS NULL OR c.referral_source != 'meta_ads')));
  ELSIF p_exclude_no_tags THEN
    SELECT COUNT(DISTINCT c.id) INTO v_total
    FROM conversations c
    WHERE c.tenant_id = v_tenant_id
      AND c.status IN ('open', 'pending')
      AND NOT EXISTS (SELECT 1 FROM contact_tags ct WHERE ct.contact_id = c.contact_id AND ct.tenant_id = v_tenant_id)
      AND (p_department_id IS NULL OR c.department_id = p_department_id)
      AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
      AND (p_channel_id IS NULL OR c.channel_id = p_channel_id)
      AND (p_origin IS NULL OR 
           (p_origin = 'meta_ads' AND c.referral_source = 'meta_ads') OR
           (p_origin = 'organic' AND (c.referral_source IS NULL OR c.referral_source != 'meta_ads')));
  ELSE
    v_total := 0;
  END IF;

  -- Return results with total
  IF array_length(p_tag_ids, 1) > 0 THEN
    RETURN QUERY
    SELECT DISTINCT c.id as conversation_id, c.contact_id, v_total as total_count
    FROM conversations c
    INNER JOIN contact_tags ct ON ct.contact_id = c.contact_id
    WHERE c.tenant_id = v_tenant_id
      AND ct.tenant_id = v_tenant_id
      AND c.status IN ('open', 'pending')
      AND ct.tag_id = ANY(p_tag_ids)
      AND (p_department_id IS NULL OR c.department_id = p_department_id)
      AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
      AND (p_channel_id IS NULL OR c.channel_id = p_channel_id)
      AND (p_origin IS NULL OR 
           (p_origin = 'meta_ads' AND c.referral_source = 'meta_ads') OR
           (p_origin = 'organic' AND (c.referral_source IS NULL OR c.referral_source != 'meta_ads')))
    ORDER BY c.id
    LIMIT p_limit
    OFFSET p_offset;
  ELSIF p_exclude_no_tags THEN
    RETURN QUERY
    SELECT DISTINCT c.id as conversation_id, c.contact_id, v_total as total_count
    FROM conversations c
    WHERE c.tenant_id = v_tenant_id
      AND c.status IN ('open', 'pending')
      AND NOT EXISTS (SELECT 1 FROM contact_tags ct WHERE ct.contact_id = c.contact_id AND ct.tenant_id = v_tenant_id)
      AND (p_department_id IS NULL OR c.department_id = p_department_id)
      AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
      AND (p_channel_id IS NULL OR c.channel_id = p_channel_id)
      AND (p_origin IS NULL OR 
           (p_origin = 'meta_ads' AND c.referral_source = 'meta_ads') OR
           (p_origin = 'organic' AND (c.referral_source IS NULL OR c.referral_source != 'meta_ads')))
    ORDER BY c.id
    LIMIT p_limit
    OFFSET p_offset;
  END IF;
END;
$$;

-- 6. get_agent_waiting_conversations - Conversas aguardando do agente
DROP FUNCTION IF EXISTS get_agent_waiting_conversations(uuid);

CREATE OR REPLACE FUNCTION get_agent_waiting_conversations(p_agent_id uuid)
RETURNS TABLE(
  conversation_id uuid,
  contact_id uuid,
  contact_name text,
  contact_phone text,
  contact_avatar text,
  last_message_preview text,
  waiting_since timestamp with time zone,
  waiting_minutes integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  v_tenant_id := get_user_tenant_id();
  
  RETURN QUERY
  SELECT 
    c.id as conversation_id,
    ct.id as contact_id,
    ct.full_name as contact_name,
    ct.phone as contact_phone,
    ct.avatar_url as contact_avatar,
    c.last_message_preview,
    c.last_message_at as waiting_since,
    COALESCE(
      EXTRACT(EPOCH FROM (NOW() - c.last_message_at)) / 60,
      0
    )::INTEGER as waiting_minutes
  FROM conversations c
  INNER JOIN contacts ct ON ct.id = c.contact_id
  WHERE c.tenant_id = v_tenant_id
    AND ct.tenant_id = v_tenant_id
    AND c.assigned_to = p_agent_id
    AND c.status = 'open'
    AND c.last_message_is_from_me = false
  ORDER BY c.last_message_at ASC;
END;
$$;

-- 7. get_internal_chat_threads - Threads do chat interno
DROP FUNCTION IF EXISTS get_internal_chat_threads(uuid);

CREATE OR REPLACE FUNCTION get_internal_chat_threads(p_user_id uuid)
RETURNS TABLE(
  thread_id uuid,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  last_message_at timestamp with time zone,
  last_message_preview text,
  last_message_sender_id uuid,
  unread_count integer,
  other_user_id uuid,
  other_user_name text,
  other_user_avatar text,
  other_user_online boolean,
  other_user_department_id uuid,
  other_user_department_name text,
  other_user_department_color text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  v_tenant_id := get_user_tenant_id();
  
  RETURN QUERY
  SELECT 
    t.id as thread_id,
    t.created_at,
    t.updated_at,
    t.last_message_at,
    t.last_message_preview,
    t.last_message_sender_id,
    COALESCE(my_part.unread_count, 0)::integer as unread_count,
    other_p.id as other_user_id,
    other_p.full_name as other_user_name,
    other_p.avatar_url as other_user_avatar,
    COALESCE(other_p.is_online, false) as other_user_online,
    other_p.department_id as other_user_department_id,
    d.name as other_user_department_name,
    d.color as other_user_department_color
  FROM internal_chat_threads t
  INNER JOIN internal_chat_participants my_part ON my_part.thread_id = t.id AND my_part.user_id = p_user_id
  INNER JOIN internal_chat_participants other_part ON other_part.thread_id = t.id AND other_part.user_id != p_user_id
  INNER JOIN profiles other_p ON other_p.id = other_part.user_id
  LEFT JOIN departments d ON d.id = other_p.department_id
  WHERE t.tenant_id = v_tenant_id
  ORDER BY t.last_message_at DESC NULLS LAST;
END;
$$;

-- 8. get_transfer_history - Histórico de transferências
DROP FUNCTION IF EXISTS get_transfer_history(timestamp with time zone, timestamp with time zone, uuid, uuid, uuid, uuid, text, text, integer, integer);

CREATE OR REPLACE FUNCTION get_transfer_history(
  p_date_from timestamp with time zone,
  p_date_to timestamp with time zone,
  p_from_user_id uuid DEFAULT NULL,
  p_to_user_id uuid DEFAULT NULL,
  p_from_department_id uuid DEFAULT NULL,
  p_to_department_id uuid DEFAULT NULL,
  p_transfer_type text DEFAULT 'all',
  p_search_query text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  conversation_id uuid,
  contact_id uuid,
  contact_name text,
  contact_phone text,
  transferred_at timestamp with time zone,
  from_user_id uuid,
  from_user_name text,
  to_user_id uuid,
  to_user_name text,
  from_department_id uuid,
  from_department_name text,
  to_department_id uuid,
  to_department_name text,
  transfer_note text,
  is_return boolean,
  is_share boolean,
  actor_id uuid,
  actor_name text,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_count BIGINT;
  v_tenant_id uuid;
BEGIN
  v_tenant_id := get_user_tenant_id();
  
  -- Get total count first
  SELECT COUNT(*) INTO v_total_count
  FROM conversation_events ce
  JOIN conversations c ON ce.conversation_id = c.id
  JOIN contacts ct ON c.contact_id = ct.id
  WHERE ce.tenant_id = v_tenant_id
    AND c.tenant_id = v_tenant_id
    AND ct.tenant_id = v_tenant_id
    AND ce.event_type IN ('transfer', 'return', 'share')
    AND ce.created_at BETWEEN p_date_from AND p_date_to
    AND (
      p_transfer_type = 'all' 
      OR (p_transfer_type = 'transfer' AND ce.event_type = 'transfer')
      OR (p_transfer_type = 'return' AND ce.event_type = 'return')
      OR (p_transfer_type = 'share' AND ce.event_type = 'share')
    )
    AND (
      p_from_user_id IS NULL 
      OR (ce.data->>'from_user_id')::UUID = p_from_user_id
      OR (ce.event_type = 'share' AND ce.actor_id = p_from_user_id)
    )
    AND (
      p_to_user_id IS NULL 
      OR (ce.data->>'to_user_id')::UUID = p_to_user_id
      OR (ce.data->>'shared_with_user_id')::UUID = p_to_user_id
    )
    AND (
      p_from_department_id IS NULL 
      OR (ce.data->>'from_department_id')::UUID = p_from_department_id
    )
    AND (
      p_to_department_id IS NULL 
      OR (ce.data->>'to_department_id')::UUID = p_to_department_id
      OR (ce.data->>'shared_with_department_id')::UUID = p_to_department_id
    )
    AND (
      p_search_query IS NULL 
      OR ct.full_name ILIKE '%' || p_search_query || '%'
      OR ct.phone ILIKE '%' || p_search_query || '%'
    );

  -- Return results with total count
  RETURN QUERY
  SELECT 
    ce.id,
    ce.conversation_id,
    c.contact_id,
    ct.full_name AS contact_name,
    ct.phone AS contact_phone,
    ce.created_at AS transferred_at,
    CASE 
      WHEN ce.event_type = 'share' THEN ce.actor_id
      ELSE (ce.data->>'from_user_id')::UUID
    END AS from_user_id,
    CASE 
      WHEN ce.event_type = 'share' THEN (SELECT full_name FROM profiles WHERE profiles.id = ce.actor_id)
      ELSE (SELECT full_name FROM profiles WHERE profiles.id = (ce.data->>'from_user_id')::UUID)
    END AS from_user_name,
    CASE 
      WHEN ce.event_type = 'share' THEN (ce.data->>'shared_with_user_id')::UUID
      ELSE (ce.data->>'to_user_id')::UUID
    END AS to_user_id,
    CASE 
      WHEN ce.event_type = 'share' THEN (SELECT full_name FROM profiles WHERE profiles.id = (ce.data->>'shared_with_user_id')::UUID)
      ELSE (SELECT full_name FROM profiles WHERE profiles.id = (ce.data->>'to_user_id')::UUID)
    END AS to_user_name,
    (ce.data->>'from_department_id')::UUID AS from_department_id,
    (SELECT name FROM departments WHERE departments.id = (ce.data->>'from_department_id')::UUID) AS from_department_name,
    CASE 
      WHEN ce.event_type = 'share' THEN (ce.data->>'shared_with_department_id')::UUID
      ELSE (ce.data->>'to_department_id')::UUID
    END AS to_department_id,
    CASE 
      WHEN ce.event_type = 'share' THEN (SELECT name FROM departments WHERE departments.id = (ce.data->>'shared_with_department_id')::UUID)
      ELSE (SELECT name FROM departments WHERE departments.id = (ce.data->>'to_department_id')::UUID)
    END AS to_department_name,
    COALESCE(ce.data->>'note', ce.data->>'transfer_note') AS transfer_note,
    ce.event_type = 'return' AS is_return,
    ce.event_type = 'share' AS is_share,
    ce.actor_id,
    (SELECT full_name FROM profiles WHERE profiles.id = ce.actor_id) AS actor_name,
    v_total_count AS total_count
  FROM conversation_events ce
  JOIN conversations c ON ce.conversation_id = c.id
  JOIN contacts ct ON c.contact_id = ct.id
  WHERE ce.tenant_id = v_tenant_id
    AND c.tenant_id = v_tenant_id
    AND ct.tenant_id = v_tenant_id
    AND ce.event_type IN ('transfer', 'return', 'share')
    AND ce.created_at BETWEEN p_date_from AND p_date_to
    AND (
      p_transfer_type = 'all' 
      OR (p_transfer_type = 'transfer' AND ce.event_type = 'transfer')
      OR (p_transfer_type = 'return' AND ce.event_type = 'return')
      OR (p_transfer_type = 'share' AND ce.event_type = 'share')
    )
    AND (
      p_from_user_id IS NULL 
      OR (ce.data->>'from_user_id')::UUID = p_from_user_id
      OR (ce.event_type = 'share' AND ce.actor_id = p_from_user_id)
    )
    AND (
      p_to_user_id IS NULL 
      OR (ce.data->>'to_user_id')::UUID = p_to_user_id
      OR (ce.data->>'shared_with_user_id')::UUID = p_to_user_id
    )
    AND (
      p_from_department_id IS NULL 
      OR (ce.data->>'from_department_id')::UUID = p_from_department_id
    )
    AND (
      p_to_department_id IS NULL 
      OR (ce.data->>'to_department_id')::UUID = p_to_department_id
      OR (ce.data->>'shared_with_department_id')::UUID = p_to_department_id
    )
    AND (
      p_search_query IS NULL 
      OR ct.full_name ILIKE '%' || p_search_query || '%'
      OR ct.phone ILIKE '%' || p_search_query || '%'
    )
  ORDER BY ce.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;
