-- 1. Criar tabela de log primeiro
CREATE TABLE IF NOT EXISTS public.contact_merge_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merged_at TIMESTAMPTZ DEFAULT now(),
  keep_contact_id UUID NOT NULL,
  merged_contact_id UUID NOT NULL,
  keep_phone TEXT,
  merged_phone TEXT,
  keep_name TEXT,
  merged_name TEXT,
  conversations_transferred INTEGER DEFAULT 0,
  messages_transferred INTEGER DEFAULT 0,
  tags_transferred INTEGER DEFAULT 0
);

-- 2. Executar mesclagem
DO $$
DECLARE
  dup RECORD;
  conflict RECORD;
  v_keep_id UUID;
  v_merge_id UUID;
  v_keep_phone TEXT;
  v_merge_phone TEXT;
  v_keep_name TEXT;
  v_merge_name TEXT;
  v_conv_count INTEGER;
  v_msg_count INTEGER;
  v_tag_count INTEGER;
  v_total_merged INTEGER := 0;
  v_conv_merged INTEGER := 0;
BEGIN
  -- FASE 1: Mesclar conversas conflitantes
  FOR conflict IN (
    WITH duplicate_contacts AS (
      SELECT 
        RIGHT(phone, 8) as suffix,
        array_agg(id ORDER BY created_at ASC) as contact_ids
      FROM contacts
      WHERE phone IS NOT NULL AND LENGTH(REGEXP_REPLACE(phone, '\D', '', 'g')) >= 8
      GROUP BY RIGHT(phone, 8) HAVING COUNT(*) > 1
    ),
    expanded AS (
      SELECT suffix, unnest(contact_ids) as contact_id, contact_ids[1] as keep_contact_id
      FROM duplicate_contacts
    )
    SELECT 
      e.keep_contact_id, e.contact_id as merge_contact_id,
      c1.id as keep_conv_id, c1.channel_id,
      c2.id as merge_conv_id, c2.referral_data as merge_referral, c2.referral_source as merge_referral_source
    FROM expanded e
    INNER JOIN conversations c1 ON c1.contact_id = e.keep_contact_id
    INNER JOIN conversations c2 ON c2.contact_id = e.contact_id 
      AND c2.contact_id != e.keep_contact_id AND c2.channel_id = c1.channel_id
    WHERE c1.channel_id IS NOT NULL
  )
  LOOP
    UPDATE messages SET conversation_id = conflict.keep_conv_id WHERE conversation_id = conflict.merge_conv_id;
    INSERT INTO conversation_tags (conversation_id, tag_id, created_at)
      SELECT conflict.keep_conv_id, tag_id, created_at FROM conversation_tags WHERE conversation_id = conflict.merge_conv_id ON CONFLICT DO NOTHING;
    DELETE FROM conversation_tags WHERE conversation_id = conflict.merge_conv_id;
    UPDATE conversation_events SET conversation_id = conflict.keep_conv_id WHERE conversation_id = conflict.merge_conv_id;
    UPDATE scheduled_messages SET conversation_id = conflict.keep_conv_id WHERE conversation_id = conflict.merge_conv_id;
    UPDATE internal_notes SET conversation_id = conflict.keep_conv_id WHERE conversation_id = conflict.merge_conv_id;
    
    IF conflict.merge_referral IS NOT NULL THEN
      UPDATE conversations SET referral_data = COALESCE(referral_data, conflict.merge_referral),
        referral_source = COALESCE(referral_source, conflict.merge_referral_source)
      WHERE id = conflict.keep_conv_id AND referral_data IS NULL;
    END IF;
    
    UPDATE conversations c SET 
      last_message_at = (SELECT MAX(created_at) FROM messages WHERE conversation_id = c.id),
      last_message_preview = (SELECT LEFT(content, 100) FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1)
    WHERE c.id = conflict.keep_conv_id;
    
    DELETE FROM conversations WHERE id = conflict.merge_conv_id;
    v_conv_merged := v_conv_merged + 1;
  END LOOP;
  
  RAISE NOTICE 'Fase 1: % conversas mescladas', v_conv_merged;
  
  -- FASE 2: Mesclar contatos
  FOR dup IN (
    SELECT RIGHT(phone, 8) as suffix,
      array_agg(id ORDER BY created_at ASC) as contact_ids,
      array_agg(phone ORDER BY created_at ASC) as phones,
      array_agg(full_name ORDER BY created_at ASC) as names
    FROM contacts WHERE phone IS NOT NULL AND LENGTH(REGEXP_REPLACE(phone, '\D', '', 'g')) >= 8
    GROUP BY RIGHT(phone, 8) HAVING COUNT(*) > 1
  )
  LOOP
    v_keep_id := dup.contact_ids[1];
    v_keep_phone := dup.phones[1];
    v_keep_name := dup.names[1];
    
    FOR i IN 2..array_length(dup.contact_ids, 1)
    LOOP
      v_merge_id := dup.contact_ids[i];
      v_merge_phone := dup.phones[i];
      v_merge_name := dup.names[i];
      
      SELECT COUNT(*) INTO v_conv_count FROM conversations WHERE contact_id = v_merge_id;
      SELECT COUNT(*) INTO v_msg_count FROM messages WHERE contact_id = v_merge_id;
      SELECT COUNT(*) INTO v_tag_count FROM contact_tags WHERE contact_id = v_merge_id;
      
      UPDATE conversations SET contact_id = v_keep_id WHERE contact_id = v_merge_id;
      UPDATE messages SET contact_id = v_keep_id WHERE contact_id = v_merge_id;
      INSERT INTO contact_tags (contact_id, tag_id, created_at)
        SELECT v_keep_id, tag_id, created_at FROM contact_tags WHERE contact_id = v_merge_id ON CONFLICT DO NOTHING;
      DELETE FROM contact_tags WHERE contact_id = v_merge_id;
      UPDATE call_logs SET contact_id = v_keep_id WHERE contact_id = v_merge_id;
      UPDATE quotes SET contact_id = v_keep_id WHERE contact_id = v_merge_id;
      UPDATE orders SET contact_id = v_keep_id WHERE contact_id = v_merge_id;
      UPDATE financial_transactions SET contact_id = v_keep_id WHERE contact_id = v_merge_id;
      UPDATE deals SET contact_id = v_keep_id WHERE contact_id = v_merge_id;
      UPDATE scheduled_messages SET contact_id = v_keep_id WHERE contact_id = v_merge_id;
      UPDATE payment_links SET contact_id = v_keep_id WHERE contact_id = v_merge_id;
      UPDATE internal_emails SET contact_id = v_keep_id WHERE contact_id = v_merge_id;
      UPDATE flow_executions SET contact_id = v_keep_id WHERE contact_id = v_merge_id;
      UPDATE lead_status_history SET contact_id = v_keep_id WHERE contact_id = v_merge_id;
      UPDATE lead_assignment_history SET contact_id = v_keep_id WHERE contact_id = v_merge_id;
      UPDATE quote_expiration_notifications SET contact_id = v_keep_id WHERE contact_id = v_merge_id;
      UPDATE contact_requests SET contact_id = v_keep_id WHERE contact_id = v_merge_id;
      
      IF v_merge_name IS NOT NULL AND v_merge_name != '' AND v_merge_name !~ '^\d+$'
         AND (v_keep_name IS NULL OR v_keep_name = '' OR v_keep_name ~ '^\d+$')
      THEN UPDATE contacts SET full_name = v_merge_name WHERE id = v_keep_id; END IF;
      
      UPDATE contacts c SET 
        email = COALESCE(c.email, m.email), cpf_cnpj = COALESCE(c.cpf_cnpj, m.cpf_cnpj),
        birth_date = COALESCE(c.birth_date, m.birth_date), street = COALESCE(c.street, m.street),
        number = COALESCE(c.number, m.number), complement = COALESCE(c.complement, m.complement),
        neighborhood = COALESCE(c.neighborhood, m.neighborhood), city = COALESCE(c.city, m.city),
        state = COALESCE(c.state, m.state), zip_code = COALESCE(c.zip_code, m.zip_code),
        notes = CASE WHEN c.notes IS NULL OR c.notes = '' THEN m.notes
          WHEN m.notes IS NOT NULL AND m.notes != '' THEN c.notes || E'\n---\n' || m.notes ELSE c.notes END,
        origin = COALESCE(c.origin, m.origin), origin_campaign = COALESCE(c.origin_campaign, m.origin_campaign),
        referral_data = COALESCE(c.referral_data, m.referral_data)
      FROM contacts m WHERE c.id = v_keep_id AND m.id = v_merge_id;
      
      INSERT INTO contact_merge_log (keep_contact_id, merged_contact_id, keep_phone, merged_phone, keep_name, merged_name,
        conversations_transferred, messages_transferred, tags_transferred)
      VALUES (v_keep_id, v_merge_id, v_keep_phone, v_merge_phone, v_keep_name, v_merge_name, v_conv_count, v_msg_count, v_tag_count);
      
      DELETE FROM contacts WHERE id = v_merge_id;
      v_total_merged := v_total_merged + 1;
    END LOOP;
  END LOOP;
  
  RAISE NOTICE 'CONCLUÍDO: % conversas mescladas, % contatos mesclados', v_conv_merged, v_total_merged;
END $$;