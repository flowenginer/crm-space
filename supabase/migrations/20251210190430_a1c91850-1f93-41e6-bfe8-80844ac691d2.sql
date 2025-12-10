-- Corrigir dados históricos: marcar conversas com mensagem padrão do Meta como meta_ads
-- Esta correção é retroativa e atualiza conversas que não foram identificadas corretamente

-- Função para atualizar conversas históricas baseado nos padrões de mensagem
CREATE OR REPLACE FUNCTION public.fix_historical_origin_detection()
RETURNS TABLE(updated_count bigint, source_breakdown jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_count BIGINT := 0;
  v_breakdown JSONB := '{}'::jsonb;
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
        referral_source = CASE WHEN v_pattern.source = 'meta_ads' THEN 'meta_ads' ELSE v_pattern.source END,
        origin_detection_method = 'message_pattern_historical',
        referral_data = jsonb_build_object(
          'detected_by', 'message_pattern_historical',
          'pattern_id', v_pattern.id,
          'source', v_pattern.source,
          'fixed_at', now()
        )
      WHERE c.referral_source IS NULL
        AND c.origin_detection_method IS NULL
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
    
    IF v_count > 0 THEN
      v_updated_count := v_updated_count + v_count;
      v_breakdown := v_breakdown || jsonb_build_object(v_pattern.source, COALESCE((v_breakdown->>v_pattern.source)::bigint, 0) + v_count);
    END IF;
  END LOOP;
  
  RETURN QUERY SELECT v_updated_count, v_breakdown;
END;
$$;

-- Comentário para documentação
COMMENT ON FUNCTION public.fix_historical_origin_detection() IS 'Corrige retroativamente a identificação de origem de conversas baseado nos padrões de mensagem cadastrados';