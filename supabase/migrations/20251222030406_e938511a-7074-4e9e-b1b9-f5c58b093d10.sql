-- =============================================
-- SISTEMA DE GAMIFICAÇÃO - ESTRUTURA BASE
-- =============================================

-- 1. Perfil de gamificação do vendedor
CREATE TABLE public.gamification_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  car_color TEXT DEFAULT '#E10600',
  current_level TEXT DEFAULT 'bronze',
  total_points_alltime INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  best_streak INTEGER DEFAULT 0,
  last_sale_date DATE,
  sounds_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Registro de pontuação (cada ação gera um registro)
CREATE TABLE public.gamification_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  points INTEGER NOT NULL,
  action_type TEXT NOT NULL,
  reference_id UUID,
  reference_type TEXT,
  reference_value NUMERIC(10,2),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Rankings snapshot (diário/semanal/mensal)
CREATE TABLE public.gamification_rankings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  period_type TEXT NOT NULL,
  period_date DATE NOT NULL,
  total_points INTEGER DEFAULT 0,
  total_sales NUMERIC(10,2) DEFAULT 0,
  total_deals INTEGER DEFAULT 0,
  avg_close_time_seconds INTEGER,
  conversion_rate NUMERIC(5,2),
  position INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, period_type, period_date)
);

-- 4. Definição de badges/conquistas
CREATE TABLE public.gamification_badge_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  category TEXT DEFAULT 'general',
  criteria_type TEXT,
  criteria_value INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Badges conquistados pelos usuários
CREATE TABLE public.gamification_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  badge_code TEXT NOT NULL REFERENCES public.gamification_badge_definitions(code),
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, badge_code)
);

-- 6. Configurações do sistema
CREATE TABLE public.gamification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Eventos/notificações em tempo real
CREATE TABLE public.gamification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  user_id UUID NOT NULL,
  related_user_id UUID,
  message TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ÍNDICES PARA PERFORMANCE
-- =============================================

CREATE INDEX idx_gamification_points_user_date ON public.gamification_points(user_id, created_at DESC);
CREATE INDEX idx_gamification_points_action ON public.gamification_points(action_type);
CREATE INDEX idx_gamification_rankings_period ON public.gamification_rankings(period_type, period_date DESC);
CREATE INDEX idx_gamification_rankings_user ON public.gamification_rankings(user_id);
CREATE INDEX idx_gamification_events_user ON public.gamification_events(user_id, is_read, created_at DESC);
CREATE INDEX idx_gamification_badges_user ON public.gamification_badges(user_id);

-- =============================================
-- HABILITAR RLS
-- =============================================

ALTER TABLE public.gamification_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification_badge_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification_events ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES
-- =============================================

-- Profiles: usuários podem ver todos, editar apenas o próprio
CREATE POLICY "Users can view all gamification profiles"
ON public.gamification_profiles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can update own gamification profile"
ON public.gamification_profiles FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own gamification profile"
ON public.gamification_profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Points: todos podem ver, sistema insere
CREATE POLICY "Authenticated can view all points"
ON public.gamification_points FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated can insert points"
ON public.gamification_points FOR INSERT
TO authenticated
WITH CHECK (true);

-- Rankings: todos podem ver
CREATE POLICY "Authenticated can view all rankings"
ON public.gamification_rankings FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated can manage rankings"
ON public.gamification_rankings FOR ALL
TO authenticated
USING (true);

-- Badge Definitions: todos podem ver, admin gerencia
CREATE POLICY "Authenticated can view badge definitions"
ON public.gamification_badge_definitions FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage badge definitions"
ON public.gamification_badge_definitions FOR ALL
TO authenticated
USING (is_admin_or_supervisor(auth.uid()));

-- Badges: todos podem ver badges conquistados
CREATE POLICY "Authenticated can view all badges"
ON public.gamification_badges FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated can insert badges"
ON public.gamification_badges FOR INSERT
TO authenticated
WITH CHECK (true);

-- Settings: todos podem ver, admin gerencia
CREATE POLICY "Authenticated can view settings"
ON public.gamification_settings FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage settings"
ON public.gamification_settings FOR ALL
TO authenticated
USING (is_admin_or_supervisor(auth.uid()));

-- Events: usuários veem seus próprios eventos
CREATE POLICY "Users can view own events"
ON public.gamification_events FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR related_user_id = auth.uid());

CREATE POLICY "Authenticated can insert events"
ON public.gamification_events FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Users can update own events"
ON public.gamification_events FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- =============================================
-- HABILITAR REALTIME
-- =============================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.gamification_points;
ALTER PUBLICATION supabase_realtime ADD TABLE public.gamification_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.gamification_rankings;

-- =============================================
-- INSERIR BADGES PADRÃO
-- =============================================

INSERT INTO public.gamification_badge_definitions (code, name, description, icon, category, criteria_type, criteria_value) VALUES
-- Conquistas de Vendas
('first_sale', 'Primeira Venda', 'Fechou sua primeira venda no sistema', '🌟', 'sales', 'sales_count', 1),
('diamond_seller', 'Diamante', '10 vendas no mês', '💎', 'sales', 'monthly_sales', 10),
('sales_king', 'Rei das Vendas', '1º lugar no ranking mensal', '👑', 'sales', 'monthly_position', 1),
('rocket', 'Foguete', 'R$10.000 em vendas no mês', '🚀', 'sales', 'monthly_revenue', 10000),
('millionaire', 'Milionário', 'R$50.000 em vendas acumulado', '💰', 'sales', 'total_revenue', 50000),
-- Conquistas de Velocidade
('lightning', 'Raio', 'Fechou venda em menos de 1h', '⚡', 'speed', 'fast_sale_hours', 1),
('pole_position', 'Pole Position', 'Menor tempo médio de fechamento no mês', '🏎️', 'speed', 'fastest_closer', 1),
('sniper', 'Sniper', '5 vendas fechadas no mesmo dia', '🎯', 'speed', 'daily_sales', 5),
-- Conquistas de Consistência
('on_fire', 'Em Chamas', 'Streak de 7 dias vendendo', '🔥', 'consistency', 'streak_days', 7),
('champion', 'Campeão', '1º lugar por 3 meses consecutivos', '🏆', 'consistency', 'consecutive_wins', 3),
('growth', 'Crescimento', 'Superou própria meta 3 meses seguidos', '📈', 'consistency', 'goal_streak', 3),
-- Conquistas de Atendimento
('communicator', 'Comunicador', '100 clientes atendidos', '💬', 'attendance', 'clients_served', 100),
('punctual', 'Pontual', '50 respostas em menos de 5 min', '⏰', 'attendance', 'fast_responses', 50),
('partner', 'Parceiro', 'Taxa de conversão acima de 70%', '🤝', 'attendance', 'conversion_rate', 70);

-- =============================================
-- INSERIR CONFIGURAÇÕES PADRÃO
-- =============================================

INSERT INTO public.gamification_settings (setting_key, setting_value) VALUES
('points_config', '{
  "sale_per_10": 1,
  "bonus_fast_sale": 50,
  "bonus_high_ticket": 100,
  "high_ticket_threshold": 2000,
  "status_catalogo": 10,
  "status_orcamento": 20,
  "status_layout": 30,
  "status_aguardando_pagamento": 40,
  "first_response_5min": 15,
  "first_response_30min": 10,
  "first_response_1h": 5,
  "client_interaction": 5,
  "streak_3_days": 50,
  "streak_5_days": 100,
  "streak_7_days": 200,
  "first_sale_of_day": 25,
  "highest_sale_of_day": 50
}'::jsonb),
('season_config', '{
  "name": "Temporada",
  "start_date": null,
  "end_date": null,
  "multiplier": 1
}'::jsonb),
('sounds_enabled', 'true'::jsonb),
('animations_enabled', 'true'::jsonb);