-- FASE 3: Adicionar tenant_id filters às últimas RPCs

-- 1. detect_origin_by_message_pattern - Adicionar filtro tenant_id
CREATE OR REPLACE FUNCTION public.detect_origin_by_message_pattern(p_message text)
 RETURNS TABLE(source text, pattern_id uuid, campaign_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id UUID := get_user_tenant_id();
BEGIN
  RETURN QUERY
  SELECT 
    amp.source,
    amp.id as pattern_id,
    amp.campaign_name
  FROM ad_message_patterns amp
  WHERE amp.is_active = true
    AND amp.tenant_id = v_tenant_id
    AND (
      (amp.match_type = 'exact' AND p_message = amp.pattern)
      OR (amp.match_type = 'contains' AND p_message ILIKE '%' || amp.pattern || '%')
      OR (amp.match_type = 'starts_with' AND p_message ILIKE amp.pattern || '%')
      OR (amp.match_type = 'ends_with' AND p_message ILIKE '%' || amp.pattern)
    )
  ORDER BY amp.priority DESC, amp.created_at ASC
  LIMIT 1;
END;
$function$;

-- 2. fix_historical_origin_detection - Adicionar filtro tenant_id
CREATE OR REPLACE FUNCTION public.fix_historical_origin_detection()
 RETURNS TABLE(updated_count bigint, source_breakdown jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_updated_count BIGINT := 0;
  v_breakdown JSONB := '{}'::jsonb;
  v_pattern RECORD;
  v_count BIGINT;
  v_tenant_id UUID := get_user_tenant_id();
BEGIN
  -- Para cada padrão ativo do tenant atual
  FOR v_pattern IN 
    SELECT id, pattern, match_type, source 
    FROM ad_message_patterns 
    WHERE is_active = true
      AND tenant_id = v_tenant_id
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
        AND c.tenant_id = v_tenant_id
        AND c.id IN (
          SELECT DISTINCT conv.id
          FROM conversations conv
          INNER JOIN messages m ON m.conversation_id = conv.id
          WHERE conv.referral_source IS NULL
            AND conv.tenant_id = v_tenant_id
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
$function$;

-- 3. calculate_variation_price - Adicionar filtro tenant_id
CREATE OR REPLACE FUNCTION public.calculate_variation_price(p_product_id uuid, p_attribute_value_ids uuid[], p_tenant_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_base_price DECIMAL;
  v_final_price DECIMAL;
  v_rule RECORD;
  v_tenant_id UUID := COALESCE(p_tenant_id, get_user_tenant_id());
BEGIN
  -- Buscar preço base do produto com filtro de tenant
  SELECT base_price INTO v_base_price
  FROM public.products
  WHERE id = p_product_id
    AND tenant_id = v_tenant_id;
  
  IF v_base_price IS NULL THEN
    RETURN 0;
  END IF;
  
  v_final_price := v_base_price;
  
  -- Aplicar regras de preço por atributo com filtro de tenant
  FOR v_rule IN (
    SELECT adjustment_type, adjustment_value
    FROM public.product_attribute_price_rules
    WHERE attribute_value_id = ANY(p_attribute_value_ids)
      AND is_active = true
      AND tenant_id = v_tenant_id
      AND (product_id = p_product_id OR product_id IS NULL)
    ORDER BY priority DESC, product_id NULLS LAST
  )
  LOOP
    IF v_rule.adjustment_type = 'fixed' THEN
      v_final_price := v_final_price + v_rule.adjustment_value;
    ELSIF v_rule.adjustment_type = 'percentage' THEN
      v_final_price := v_final_price * (1 + v_rule.adjustment_value / 100);
    END IF;
  END LOOP;
  
  RETURN ROUND(v_final_price, 2);
END;
$function$;