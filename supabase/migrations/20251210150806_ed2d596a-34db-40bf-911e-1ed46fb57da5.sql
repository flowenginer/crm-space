-- ============================================
-- FASE 3: RPC OTIMIZADA PARA WEBHOOK
-- Consolida 8-15 queries em 2-3
-- ============================================

-- Função principal para processar mensagem recebida
-- Faz tudo em uma única transação: encontra/cria contato, conversa, insere mensagem
CREATE OR REPLACE FUNCTION public.process_incoming_message(
  p_phone TEXT,
  p_channel_id UUID,
  p_channel_department_id UUID,
  p_contact_name TEXT,
  p_message_content TEXT,
  p_message_type TEXT,
  p_media_url TEXT DEFAULT NULL,
  p_media_mime_type TEXT DEFAULT NULL,
  p_whatsapp_message_id TEXT DEFAULT NULL,
  p_is_from_me BOOLEAN DEFAULT FALSE,
  p_referral_source TEXT DEFAULT NULL,
  p_referral_data JSONB DEFAULT NULL,
  p_origin TEXT DEFAULT 'whatsapp'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact_id UUID;
  v_contact_name TEXT;
  v_conversation_id UUID;
  v_conversation_assigned_to UUID;
  v_conversation_status TEXT;
  v_message_id UUID;
  v_is_new_contact BOOLEAN := FALSE;
  v_is_new_conversation BOOLEAN := FALSE;
  v_should_reopen BOOLEAN := FALSE;
BEGIN
  -- =====================================================
  -- 1. ENCONTRAR OU CRIAR CONTATO
  -- =====================================================
  SELECT id, full_name INTO v_contact_id, v_contact_name
  FROM contacts
  WHERE phone = p_phone
  LIMIT 1;

  IF v_contact_id IS NULL THEN
    -- Criar novo contato
    INSERT INTO contacts (
      phone, 
      full_name, 
      first_contact_at, 
      origin,
      origin_campaign,
      referral_data
    )
    VALUES (
      p_phone,
      COALESCE(NULLIF(p_contact_name, ''), 'WhatsApp ' || p_phone),
      NOW(),
      p_origin,
      CASE WHEN p_referral_source = 'meta_ads' THEN 'Meta Ads' ELSE NULL END,
      p_referral_data
    )
    RETURNING id, full_name INTO v_contact_id, v_contact_name;
    
    v_is_new_contact := TRUE;
  ELSE
    -- Atualizar nome se estava genérico e agora temos um nome real
    IF p_contact_name IS NOT NULL 
       AND p_contact_name != '' 
       AND v_contact_name LIKE 'WhatsApp %' 
       AND p_contact_name NOT LIKE 'WhatsApp %' THEN
      UPDATE contacts 
      SET full_name = p_contact_name, updated_at = NOW()
      WHERE id = v_contact_id;
      v_contact_name := p_contact_name;
    END IF;
    
    -- Atualizar referral_data se veio de Meta Ads e não tinha antes
    IF p_referral_source = 'meta_ads' AND p_referral_data IS NOT NULL THEN
      UPDATE contacts
      SET 
        referral_data = COALESCE(referral_data, '{}'::jsonb) || p_referral_data,
        origin = COALESCE(origin, p_origin),
        origin_campaign = COALESCE(origin_campaign, 'Meta Ads'),
        updated_at = NOW()
      WHERE id = v_contact_id
        AND (referral_data IS NULL OR referral_data = '{}'::jsonb);
    END IF;
  END IF;

  -- =====================================================
  -- 2. ENCONTRAR OU CRIAR CONVERSA
  -- =====================================================
  SELECT id, assigned_to, status 
  INTO v_conversation_id, v_conversation_assigned_to, v_conversation_status
  FROM conversations
  WHERE contact_id = v_contact_id
    AND channel_id = p_channel_id
  ORDER BY 
    CASE WHEN status IN ('open', 'pending') THEN 0 ELSE 1 END,
    created_at DESC
  LIMIT 1;

  IF v_conversation_id IS NULL THEN
    -- Criar nova conversa
    INSERT INTO conversations (
      contact_id,
      channel_id,
      department_id,
      status,
      is_unread,
      unread_count,
      last_message_at,
      last_message_preview,
      last_message_is_from_me,
      referral_source,
      referral_data
    )
    VALUES (
      v_contact_id,
      p_channel_id,
      p_channel_department_id,
      'open',
      NOT p_is_from_me,
      CASE WHEN p_is_from_me THEN 0 ELSE 1 END,
      NOW(),
      LEFT(COALESCE(p_message_content, '[Mídia]'), 100),
      p_is_from_me,
      p_referral_source,
      p_referral_data
    )
    RETURNING id, assigned_to INTO v_conversation_id, v_conversation_assigned_to;
    
    v_is_new_conversation := TRUE;
  ELSE
    -- Verificar se precisa reabrir conversa fechada
    IF v_conversation_status = 'closed' AND NOT p_is_from_me THEN
      v_should_reopen := TRUE;
      
      -- Salvar dados do fechamento anterior antes de reabrir
      UPDATE conversations
      SET 
        previous_closed_at = closed_at,
        previous_close_reason = close_reason,
        previous_closed_by = closed_by,
        status = 'open',
        closed_at = NULL,
        close_reason = NULL,
        closed_by = NULL,
        is_unread = TRUE,
        unread_count = 1,
        last_message_at = NOW(),
        last_message_preview = LEFT(COALESCE(p_message_content, '[Mídia]'), 100),
        last_message_is_from_me = p_is_from_me,
        reopened_at = NOW(),
        reopen_count = COALESCE(reopen_count, 0) + 1,
        updated_at = NOW()
      WHERE id = v_conversation_id;
      
      v_conversation_status := 'open';
    ELSE
      -- Atualizar conversa existente
      IF p_is_from_me THEN
        -- Mensagem enviada: apenas atualiza preview e timestamp
        UPDATE conversations
        SET 
          last_message_at = NOW(),
          last_message_preview = LEFT(COALESCE(p_message_content, '[Mídia]'), 100),
          last_message_is_from_me = TRUE,
          updated_at = NOW()
        WHERE id = v_conversation_id;
      ELSE
        -- Mensagem recebida: incrementar contador de não lidas
        UPDATE conversations
        SET 
          is_unread = TRUE,
          unread_count = COALESCE(unread_count, 0) + 1,
          last_message_at = NOW(),
          last_message_preview = LEFT(COALESCE(p_message_content, '[Mídia]'), 100),
          last_message_is_from_me = FALSE,
          updated_at = NOW()
        WHERE id = v_conversation_id;
      END IF;
    END IF;
  END IF;

  -- =====================================================
  -- 3. INSERIR MENSAGEM
  -- =====================================================
  INSERT INTO messages (
    conversation_id,
    contact_id,
    content,
    message_type,
    media_url,
    media_mime_type,
    whatsapp_message_id,
    is_from_me,
    status,
    created_at
  )
  VALUES (
    v_conversation_id,
    CASE WHEN NOT p_is_from_me THEN v_contact_id ELSE NULL END,
    p_message_content,
    p_message_type,
    p_media_url,
    p_media_mime_type,
    p_whatsapp_message_id,
    p_is_from_me,
    CASE WHEN p_is_from_me THEN 'sent' ELSE 'received' END,
    NOW()
  )
  RETURNING id INTO v_message_id;

  -- =====================================================
  -- 4. REGISTRAR EVENTO SE REABRIU
  -- =====================================================
  IF v_should_reopen THEN
    INSERT INTO conversation_events (
      conversation_id,
      event_type,
      data
    )
    VALUES (
      v_conversation_id,
      'reopen',
      jsonb_build_object(
        'reason', 'customer_message',
        'message_id', v_message_id
      )
    );
  END IF;

  -- =====================================================
  -- 5. RETORNAR RESULTADO
  -- =====================================================
  RETURN jsonb_build_object(
    'success', TRUE,
    'contact_id', v_contact_id,
    'contact_name', v_contact_name,
    'conversation_id', v_conversation_id,
    'conversation_assigned_to', v_conversation_assigned_to,
    'message_id', v_message_id,
    'is_new_contact', v_is_new_contact,
    'is_new_conversation', v_is_new_conversation,
    'was_reopened', v_should_reopen
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', FALSE,
    'error', SQLERRM,
    'error_detail', SQLSTATE
  );
END;
$$;

-- =====================================================
-- Função para buscar canal por instance_id (otimizada)
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_channel_by_instance(
  p_instance_id TEXT
)
RETURNS TABLE(
  id UUID,
  name TEXT,
  instance_id TEXT,
  department_id UUID,
  provider_code TEXT,
  provider_base_url TEXT,
  provider_admin_token TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    c.id,
    c.name,
    c.instance_id,
    c.department_id,
    p.code as provider_code,
    p.base_url as provider_base_url,
    p.admin_token as provider_admin_token
  FROM whatsapp_channels c
  INNER JOIN whatsapp_providers p ON p.id = c.provider_id
  WHERE c.instance_id = p_instance_id
    AND c.is_deleted = FALSE
  LIMIT 1;
$$;

-- =====================================================
-- Função para atualizar mensagem fromMe com whatsapp_message_id
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_message_whatsapp_id(
  p_conversation_id UUID,
  p_message_type TEXT,
  p_content TEXT,
  p_whatsapp_message_id TEXT,
  p_media_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_message_id UUID;
  v_thirty_seconds_ago TIMESTAMPTZ := NOW() - INTERVAL '30 seconds';
BEGIN
  -- Verificar se já existe mensagem com esse whatsapp_id
  SELECT id INTO v_message_id
  FROM messages
  WHERE whatsapp_message_id = p_whatsapp_message_id
  LIMIT 1;

  IF v_message_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', TRUE,
      'action', 'already_exists',
      'message_id', v_message_id
    );
  END IF;

  -- Buscar mensagem pendente para atualizar
  IF p_message_type = 'text' THEN
    -- Para texto, tentar match por conteúdo
    UPDATE messages
    SET whatsapp_message_id = p_whatsapp_message_id, updated_at = NOW()
    WHERE id = (
      SELECT id FROM messages
      WHERE conversation_id = p_conversation_id
        AND is_from_me = TRUE
        AND message_type = p_message_type
        AND whatsapp_message_id IS NULL
        AND created_at >= v_thirty_seconds_ago
        AND (
          content = p_content
          OR p_content LIKE '%' || content || '%'
          OR content LIKE '%' || p_content || '%'
        )
      ORDER BY created_at DESC
      LIMIT 1
    )
    RETURNING id INTO v_message_id;
  ELSE
    -- Para mídia, match por tipo
    UPDATE messages
    SET 
      whatsapp_message_id = p_whatsapp_message_id,
      media_url = COALESCE(p_media_url, media_url),
      updated_at = NOW()
    WHERE id = (
      SELECT id FROM messages
      WHERE conversation_id = p_conversation_id
        AND is_from_me = TRUE
        AND message_type = p_message_type
        AND whatsapp_message_id IS NULL
        AND created_at >= v_thirty_seconds_ago
      ORDER BY created_at DESC
      LIMIT 1
    )
    RETURNING id INTO v_message_id;
  END IF;

  IF v_message_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', TRUE,
      'action', 'updated',
      'message_id', v_message_id
    );
  END IF;

  RETURN jsonb_build_object(
    'success', FALSE,
    'action', 'not_found'
  );
END;
$$;

-- =====================================================
-- FASE 4: OTIMIZAÇÃO DO DASHBOARD
-- Cache de conversion_status_names para evitar query extra
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_conversion_status_names()
RETURNS TEXT[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    array_agg(ls.name),
    ARRAY[]::TEXT[]
  )
  FROM company_settings cs
  CROSS JOIN LATERAL unnest(COALESCE(cs.conversion_status_ids, ARRAY[]::UUID[])) AS status_id
  INNER JOIN lead_statuses ls ON ls.id = status_id
  LIMIT 1;
$$;

-- =====================================================
-- Dashboard agregado: todas as métricas em uma única chamada
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_dashboard_metrics_aggregated(
  p_date_from TIMESTAMPTZ,
  p_date_to TIMESTAMPTZ,
  p_agent_id UUID DEFAULT NULL,
  p_department_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversion_names TEXT[];
  v_metrics JSONB;
  v_origin_data JSONB;
  v_status_funnel JSONB;
  v_alerts JSONB;
  v_total_conversations BIGINT;
  v_total_assigned BIGINT;
  v_total_responded BIGINT;
  v_avg_response_time INTEGER;
  v_avg_assignment_time INTEGER;
  v_conversions BIGINT;
BEGIN
  -- Obter nomes dos status de conversão
  v_conversion_names := get_conversion_status_names();

  -- =====================================================
  -- MÉTRICAS PRINCIPAIS
  -- =====================================================
  SELECT COUNT(*) INTO v_total_conversations
  FROM conversations c
  WHERE c.created_at >= p_date_from
    AND c.created_at <= p_date_to
    AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
    AND (p_department_id IS NULL OR c.department_id = p_department_id);

  SELECT COUNT(*) INTO v_total_assigned
  FROM conversations c
  WHERE c.created_at >= p_date_from
    AND c.created_at <= p_date_to
    AND c.assigned_to IS NOT NULL
    AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
    AND (p_department_id IS NULL OR c.department_id = p_department_id);

  SELECT COUNT(*) INTO v_total_responded
  FROM conversations c
  WHERE c.created_at >= p_date_from
    AND c.created_at <= p_date_to
    AND c.first_response_at IS NOT NULL
    AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
    AND (p_department_id IS NULL OR c.department_id = p_department_id);

  SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (c.first_response_at - c.created_at)))::INTEGER, 0)
  INTO v_avg_response_time
  FROM conversations c
  WHERE c.created_at >= p_date_from
    AND c.created_at <= p_date_to
    AND c.first_response_at IS NOT NULL
    AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
    AND (p_department_id IS NULL OR c.department_id = p_department_id);

  SELECT COALESCE(AVG(lah.time_to_assign_seconds)::INTEGER, 0)
  INTO v_avg_assignment_time
  FROM lead_assignment_history lah
  WHERE lah.assigned_at >= p_date_from
    AND lah.assigned_at <= p_date_to
    AND lah.assignment_type = 'first_assignment'
    AND (p_agent_id IS NULL OR lah.assigned_to = p_agent_id);

  SELECT COUNT(DISTINCT lsh.contact_id) INTO v_conversions
  FROM lead_status_history lsh
  INNER JOIN conversations c ON c.contact_id = lsh.contact_id
  WHERE lsh.new_status = ANY(v_conversion_names)
    AND lsh.changed_at >= p_date_from
    AND lsh.changed_at <= p_date_to
    AND c.created_at >= p_date_from
    AND c.created_at <= p_date_to
    AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
    AND (p_department_id IS NULL OR c.department_id = p_department_id);

  v_metrics := jsonb_build_object(
    'total_conversations', v_total_conversations,
    'total_assigned', v_total_assigned,
    'total_unassigned', v_total_conversations - v_total_assigned,
    'total_responded', v_total_responded,
    'avg_time_to_assignment', v_avg_assignment_time,
    'avg_time_to_first_response', v_avg_response_time,
    'assignment_rate', CASE WHEN v_total_conversations > 0 
      THEN ROUND((v_total_assigned::NUMERIC / v_total_conversations * 100), 1) 
      ELSE 0 END,
    'response_rate', CASE WHEN v_total_conversations > 0 
      THEN ROUND((v_total_responded::NUMERIC / v_total_conversations * 100), 1) 
      ELSE 0 END,
    'conversions', v_conversions,
    'conversion_rate', CASE WHEN v_total_conversations > 0 
      THEN ROUND((v_conversions::NUMERIC / v_total_conversations * 100), 1) 
      ELSE 0 END
  );

  -- =====================================================
  -- DADOS POR ORIGEM
  -- =====================================================
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_origin_data
  FROM (
    SELECT 
      COALESCE(
        CASE 
          WHEN c.referral_source = 'meta_ads' THEN 'meta_ads'
          WHEN ct.origin = 'linktree' THEN 'linktree'
          WHEN ct.origin = 'manual' THEN 'manual'
          ELSE 'organic'
        END,
        'organic'
      ) as origin,
      COUNT(DISTINCT c.id) as total,
      COUNT(DISTINCT CASE WHEN ct.lead_status = ANY(v_conversion_names) THEN c.id END) as converted
    FROM conversations c
    INNER JOIN contacts ct ON ct.id = c.contact_id
    WHERE c.created_at >= p_date_from
      AND c.created_at <= p_date_to
      AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
      AND (p_department_id IS NULL OR c.department_id = p_department_id)
    GROUP BY 1
    ORDER BY total DESC
  ) t;

  -- =====================================================
  -- STATUS FUNNEL
  -- =====================================================
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_status_funnel
  FROM (
    SELECT 
      ls.name as status_name,
      ls.color,
      ls.order_position,
      COUNT(ct.id) as status_count,
      COALESCE(AVG(lsh.duration_seconds), 0)::INTEGER as avg_duration
    FROM lead_statuses ls
    LEFT JOIN contacts ct ON ct.lead_status = ls.name
      AND ct.id IN (
        SELECT DISTINCT contact_id FROM conversations 
        WHERE created_at >= p_date_from AND created_at <= p_date_to
          AND (p_agent_id IS NULL OR assigned_to = p_agent_id)
          AND (p_department_id IS NULL OR department_id = p_department_id)
      )
    LEFT JOIN lead_status_history lsh ON lsh.contact_id = ct.id AND lsh.new_status = ls.name
    WHERE ls.is_active = TRUE
    GROUP BY ls.id, ls.name, ls.color, ls.order_position
    ORDER BY ls.order_position
  ) t;

  RETURN jsonb_build_object(
    'metrics', v_metrics,
    'origin_data', v_origin_data,
    'status_funnel', v_status_funnel
  );
END;
$$;

-- Garantir que as funções são acessíveis
GRANT EXECUTE ON FUNCTION public.process_incoming_message TO service_role;
GRANT EXECUTE ON FUNCTION public.get_channel_by_instance TO service_role;
GRANT EXECUTE ON FUNCTION public.update_message_whatsapp_id TO service_role;
GRANT EXECUTE ON FUNCTION public.get_conversion_status_names TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_metrics_aggregated TO authenticated;