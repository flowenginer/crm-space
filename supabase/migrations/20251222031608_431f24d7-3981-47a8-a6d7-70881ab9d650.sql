-- ===========================================
-- FASE 5: TRIGGERS DE PONTUAÇÃO AUTOMÁTICA
-- ===========================================

-- Adicionar colunas faltantes no profiles de gamificação
ALTER TABLE gamification_profiles ADD COLUMN IF NOT EXISTS total_sales DECIMAL DEFAULT 0;
ALTER TABLE gamification_profiles ADD COLUMN IF NOT EXISTS total_deals INTEGER DEFAULT 0;
ALTER TABLE gamification_profiles ADD COLUMN IF NOT EXISTS total_points INTEGER DEFAULT 0;

-- Função para pontuar automaticamente quando lead muda de status
CREATE OR REPLACE FUNCTION public.gamification_on_lead_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_points INTEGER := 0;
  v_assigned_user UUID;
BEGIN
  -- Só processa se status realmente mudou
  IF OLD.lead_status IS DISTINCT FROM NEW.lead_status AND NEW.lead_status IS NOT NULL THEN
    -- Pontuação padrão por status
    v_points := CASE NEW.lead_status
      WHEN 'catalogo' THEN 10
      WHEN 'orcamento' THEN 20
      WHEN 'layout' THEN 30
      WHEN 'aguardando_pagamento' THEN 40
      WHEN 'pago' THEN 100
      ELSE 5
    END;
    
    v_assigned_user := NEW.assigned_to;
    
    IF v_assigned_user IS NOT NULL AND v_points > 0 THEN
      INSERT INTO gamification_points (user_id, points, action_type, reference_type, reference_id, description)
      VALUES (v_assigned_user, v_points, 'status_change', 'contact', NEW.id, 'Mudança para status: ' || NEW.lead_status);
      
      INSERT INTO gamification_profiles (user_id, total_points, total_points_alltime)
      VALUES (v_assigned_user, v_points, v_points)
      ON CONFLICT (user_id) DO UPDATE SET
        total_points = gamification_profiles.total_points + v_points,
        total_points_alltime = gamification_profiles.total_points_alltime + v_points,
        updated_at = NOW();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Função para pontuar venda (ordem paga)
CREATE OR REPLACE FUNCTION public.gamification_on_order_paid()
RETURNS TRIGGER AS $$
DECLARE
  v_points INTEGER := 0;
  v_bonus_points INTEGER := 0;
  v_order_value DECIMAL;
  v_assigned_user UUID;
  v_contact RECORD;
  v_time_to_close INTERVAL;
BEGIN
  IF (OLD.status IS DISTINCT FROM NEW.status) AND NEW.status IN ('paid', 'pago', 'completed', 'concluido') THEN
    v_order_value := COALESCE(NEW.total, 0);
    
    SELECT * INTO v_contact FROM contacts WHERE id = NEW.contact_id;
    v_assigned_user := COALESCE(v_contact.assigned_to, NEW.created_by);
    
    IF v_assigned_user IS NOT NULL THEN
      v_points := GREATEST(FLOOR(v_order_value / 10)::INTEGER, 10);
      
      IF v_order_value > 2000 THEN
        v_bonus_points := v_bonus_points + 100;
      END IF;
      
      IF v_contact.created_at IS NOT NULL THEN
        v_time_to_close := NOW() - v_contact.created_at;
        IF v_time_to_close < INTERVAL '24 hours' THEN
          v_bonus_points := v_bonus_points + 50;
        ELSIF v_time_to_close < INTERVAL '48 hours' THEN
          v_bonus_points := v_bonus_points + 25;
        END IF;
      END IF;
      
      INSERT INTO gamification_points (user_id, points, action_type, reference_type, reference_id, reference_value, description)
      VALUES (v_assigned_user, v_points + v_bonus_points, 'sale', 'order', NEW.id, v_order_value, 'Venda: R$ ' || v_order_value::TEXT);
      
      INSERT INTO gamification_profiles (user_id, total_points, total_points_alltime, total_sales, total_deals)
      VALUES (v_assigned_user, v_points + v_bonus_points, v_points + v_bonus_points, v_order_value, 1)
      ON CONFLICT (user_id) DO UPDATE SET
        total_points = gamification_profiles.total_points + v_points + v_bonus_points,
        total_points_alltime = gamification_profiles.total_points_alltime + v_points + v_bonus_points,
        total_sales = COALESCE(gamification_profiles.total_sales, 0) + v_order_value,
        total_deals = COALESCE(gamification_profiles.total_deals, 0) + 1,
        last_sale_date = CURRENT_DATE,
        updated_at = NOW();
      
      PERFORM gamification_check_badges(v_assigned_user);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Função para pontuar resposta rápida
CREATE OR REPLACE FUNCTION public.gamification_on_fast_response()
RETURNS TRIGGER AS $$
DECLARE
  v_points INTEGER := 0;
  v_last_client_msg RECORD;
  v_response_time INTERVAL;
  v_assigned_user UUID;
BEGIN
  IF NEW.is_from_me = true THEN
    SELECT * INTO v_last_client_msg FROM messages
    WHERE conversation_id = NEW.conversation_id AND is_from_me = false AND created_at < NEW.created_at
    ORDER BY created_at DESC LIMIT 1;
    
    IF v_last_client_msg IS NOT NULL THEN
      v_response_time := NEW.created_at - v_last_client_msg.created_at;
      
      IF v_response_time < INTERVAL '5 minutes' THEN
        v_points := 15;
      ELSIF v_response_time < INTERVAL '30 minutes' THEN
        v_points := 10;
      ELSIF v_response_time < INTERVAL '1 hour' THEN
        v_points := 5;
      END IF;
      
      IF v_points > 0 THEN
        SELECT assigned_to INTO v_assigned_user FROM conversations WHERE id = NEW.conversation_id;
        
        IF v_assigned_user IS NOT NULL THEN
          INSERT INTO gamification_points (user_id, points, action_type, reference_type, reference_id, description)
          VALUES (v_assigned_user, v_points, 'fast_response', 'message', NEW.id, 'Resposta rápida');
          
          INSERT INTO gamification_profiles (user_id, total_points, total_points_alltime)
          VALUES (v_assigned_user, v_points, v_points)
          ON CONFLICT (user_id) DO UPDATE SET
            total_points = gamification_profiles.total_points + v_points,
            total_points_alltime = gamification_profiles.total_points_alltime + v_points,
            updated_at = NOW();
        END IF;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Função para verificar e conceder badges
CREATE OR REPLACE FUNCTION public.gamification_check_badges(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_profile RECORD;
  v_badge RECORD;
  v_earned BOOLEAN;
BEGIN
  SELECT * INTO v_profile FROM gamification_profiles WHERE user_id = p_user_id;
  IF v_profile IS NULL THEN RETURN; END IF;
  
  FOR v_badge IN SELECT * FROM gamification_badge_definitions WHERE is_active = true
  LOOP
    SELECT EXISTS (SELECT 1 FROM gamification_badges WHERE user_id = p_user_id AND badge_code = v_badge.code) INTO v_earned;
    
    IF NOT v_earned THEN
      CASE v_badge.criteria_type
        WHEN 'sales_count' THEN
          IF COALESCE(v_profile.total_deals, 0) >= v_badge.criteria_value THEN
            INSERT INTO gamification_badges (user_id, badge_code) VALUES (p_user_id, v_badge.code);
          END IF;
        WHEN 'monthly_sales' THEN
          IF COALESCE(v_profile.total_deals, 0) >= v_badge.criteria_value THEN
            INSERT INTO gamification_badges (user_id, badge_code) VALUES (p_user_id, v_badge.code);
          END IF;
        WHEN 'monthly_revenue' THEN
          IF COALESCE(v_profile.total_sales, 0) >= v_badge.criteria_value THEN
            INSERT INTO gamification_badges (user_id, badge_code) VALUES (p_user_id, v_badge.code);
          END IF;
        WHEN 'total_revenue' THEN
          IF COALESCE(v_profile.total_sales, 0) >= v_badge.criteria_value THEN
            INSERT INTO gamification_badges (user_id, badge_code) VALUES (p_user_id, v_badge.code);
          END IF;
        WHEN 'fast_response_count' THEN
          IF (SELECT COUNT(*) FROM gamification_points WHERE user_id = p_user_id AND action_type = 'fast_response') >= v_badge.criteria_value THEN
            INSERT INTO gamification_badges (user_id, badge_code) VALUES (p_user_id, v_badge.code);
          END IF;
        ELSE
          NULL;
      END CASE;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar triggers
DROP TRIGGER IF EXISTS gamification_lead_status_trigger ON contacts;
CREATE TRIGGER gamification_lead_status_trigger AFTER UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION gamification_on_lead_status_change();

DROP TRIGGER IF EXISTS gamification_order_paid_trigger ON orders;
CREATE TRIGGER gamification_order_paid_trigger AFTER UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION gamification_on_order_paid();

DROP TRIGGER IF EXISTS gamification_fast_response_trigger ON messages;
CREATE TRIGGER gamification_fast_response_trigger AFTER INSERT ON messages FOR EACH ROW EXECUTE FUNCTION gamification_on_fast_response();

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_gamification_points_user_action ON gamification_points(user_id, action_type);
CREATE INDEX IF NOT EXISTS idx_gamification_points_created ON gamification_points(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gamification_badges_user ON gamification_badges(user_id);