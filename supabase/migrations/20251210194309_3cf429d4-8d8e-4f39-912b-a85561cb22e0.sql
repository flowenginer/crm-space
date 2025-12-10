
-- Executar a correção histórica de origem das conversas
DO $$
DECLARE
  v_updated_count BIGINT := 0;
  v_pattern RECORD;
  v_count BIGINT;
BEGIN
  -- Para cada padrão ativo
  FOR v_pattern IN 
    SELECT id, pattern, match_type, source 
    FROM ad_message_patterns 
    WHERE is_active = true
    ORDER BY priority DESC
  LOOP
    -- Atualizar conversas que correspondem ao padrão e não têm origem definida
    WITH updated AS (
      UPDATE conversations c
      SET 
        referral_source = v_pattern.source,
        origin_detection_method = 'message_pattern_historical',
        referral_data = jsonb_build_object(
          'detected_by', 'message_pattern_historical',
          'pattern_id', v_pattern.id,
          'source', v_pattern.source,
          'fixed_at', now()
        )
      WHERE c.referral_source IS NULL
        AND c.id IN (
          SELECT DISTINCT conv.id
          FROM conversations conv
          INNER JOIN messages m ON m.conversation_id = conv.id
          WHERE conv.referral_source IS NULL
            AND m.is_from_me = false
            AND m.created_at = (
              SELECT MIN(m2.created_at) 
              FROM messages m2 
              WHERE m2.conversation_id = conv.id AND m2.is_from_me = false
            )
            AND (
              (v_pattern.match_type = 'exact' AND m.content = v_pattern.pattern)
              OR (v_pattern.match_type = 'contains' AND m.content ILIKE '%' || v_pattern.pattern || '%')
              OR (v_pattern.match_type = 'starts_with' AND m.content ILIKE v_pattern.pattern || '%')
              OR (v_pattern.match_type = 'ends_with' AND m.content ILIKE '%' || v_pattern.pattern)
            )
        )
      RETURNING c.id
    )
    SELECT COUNT(*) INTO v_count FROM updated;
    
    v_updated_count := v_updated_count + v_count;
    RAISE NOTICE 'Padrão % (%) - Atualizadas: %', v_pattern.source, v_pattern.pattern, v_count;
  END LOOP;
  
  RAISE NOTICE 'Total de conversas atualizadas: %', v_updated_count;
END $$;
