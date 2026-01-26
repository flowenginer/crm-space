-- =====================================================
-- SISTEMA DE TICKETS DE SUPORTE
-- =====================================================

-- Sequência para número do ticket
CREATE SEQUENCE IF NOT EXISTS support_ticket_number_seq START 1000;

-- =====================================================
-- TABELA: support_tickets
-- =====================================================
CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number INTEGER UNIQUE DEFAULT nextval('support_ticket_number_seq'),
  tenant_id UUID REFERENCES tenants(id),
  requester_id UUID NOT NULL REFERENCES profiles(id),
  assigned_to UUID REFERENCES profiles(id),
  
  -- Informações do ticket
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('bug', 'feature', 'question', 'improvement', 'performance', 'security')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting_response', 'resolved', 'closed')),
  
  -- Contexto
  affected_module TEXT,
  browser_info TEXT,
  screenshot_url TEXT,
  requester_role TEXT,
  
  -- Timestamps para métricas
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  first_response_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ
);

-- Índices para performance
CREATE INDEX idx_support_tickets_tenant ON support_tickets(tenant_id);
CREATE INDEX idx_support_tickets_status ON support_tickets(status);
CREATE INDEX idx_support_tickets_assigned ON support_tickets(assigned_to);
CREATE INDEX idx_support_tickets_requester ON support_tickets(requester_id);
CREATE INDEX idx_support_tickets_created ON support_tickets(created_at DESC);

-- =====================================================
-- TABELA: ticket_comments
-- =====================================================
CREATE TABLE public.ticket_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id),
  content TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ticket_comments_ticket ON ticket_comments(ticket_id);

-- =====================================================
-- TABELA: support_technicians
-- =====================================================
CREATE TABLE public.support_technicians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  specialties TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Trigger para updated_at
CREATE TRIGGER update_support_tickets_updated_at
BEFORE UPDATE ON support_tickets
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Função para marcar resolved_at e closed_at
CREATE OR REPLACE FUNCTION handle_ticket_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Marcar resolved_at quando status muda para resolved
  IF NEW.status = 'resolved' AND OLD.status != 'resolved' THEN
    NEW.resolved_at := NOW();
  END IF;
  
  -- Marcar closed_at quando status muda para closed
  IF NEW.status = 'closed' AND OLD.status != 'closed' THEN
    NEW.closed_at := NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ticket_status_change
BEFORE UPDATE ON support_tickets
FOR EACH ROW EXECUTE FUNCTION handle_ticket_status_change();

-- Função para marcar first_response_at quando técnico comenta
CREATE OR REPLACE FUNCTION set_ticket_first_response()
RETURNS TRIGGER AS $$
BEGIN
  -- Se é comentário de um técnico ativo
  IF EXISTS (SELECT 1 FROM support_technicians WHERE user_id = NEW.author_id AND is_active = true) THEN
    UPDATE support_tickets 
    SET first_response_at = NOW()
    WHERE id = NEW.ticket_id 
    AND first_response_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ticket_first_response
AFTER INSERT ON ticket_comments
FOR EACH ROW EXECUTE FUNCTION set_ticket_first_response();

-- =====================================================
-- FUNÇÃO HELPER: Verificar se é técnico de suporte
-- =====================================================
CREATE OR REPLACE FUNCTION is_support_technician(check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM support_technicians
    WHERE user_id = check_user_id
    AND is_active = true
  );
$$;

-- =====================================================
-- RLS: support_tickets
-- =====================================================
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

-- Técnicos veem todos os tickets
CREATE POLICY "Technicians can view all tickets"
ON support_tickets FOR SELECT
USING (is_support_technician(auth.uid()));

-- Usuários veem tickets do próprio tenant
CREATE POLICY "Users can view own tenant tickets"
ON support_tickets FOR SELECT
USING (
  tenant_id = get_user_tenant_id() 
  AND NOT is_support_technician(auth.uid())
);

-- Usuários criam tickets no próprio tenant
CREATE POLICY "Users can create tickets"
ON support_tickets FOR INSERT
WITH CHECK (
  requester_id = auth.uid()
  AND tenant_id = get_user_tenant_id()
);

-- Técnicos podem atualizar qualquer ticket
CREATE POLICY "Technicians can update all tickets"
ON support_tickets FOR UPDATE
USING (is_support_technician(auth.uid()));

-- Usuários podem atualizar próprios tickets (apenas status para reabrir)
CREATE POLICY "Users can update own tickets"
ON support_tickets FOR UPDATE
USING (
  requester_id = auth.uid()
  AND NOT is_support_technician(auth.uid())
);

-- =====================================================
-- RLS: ticket_comments
-- =====================================================
ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;

-- Técnicos veem todos os comentários
CREATE POLICY "Technicians can view all comments"
ON ticket_comments FOR SELECT
USING (is_support_technician(auth.uid()));

-- Usuários veem comentários não-internos dos tickets do tenant
CREATE POLICY "Users can view non-internal comments"
ON ticket_comments FOR SELECT
USING (
  NOT is_internal
  AND EXISTS (
    SELECT 1 FROM support_tickets
    WHERE id = ticket_comments.ticket_id
    AND tenant_id = get_user_tenant_id()
  )
);

-- Técnicos podem criar qualquer comentário
CREATE POLICY "Technicians can create comments"
ON ticket_comments FOR INSERT
WITH CHECK (
  author_id = auth.uid()
  AND is_support_technician(auth.uid())
);

-- Usuários podem criar comentários não-internos nos próprios tickets
CREATE POLICY "Users can create comments on own tickets"
ON ticket_comments FOR INSERT
WITH CHECK (
  author_id = auth.uid()
  AND NOT is_internal
  AND EXISTS (
    SELECT 1 FROM support_tickets
    WHERE id = ticket_comments.ticket_id
    AND tenant_id = get_user_tenant_id()
  )
);

-- =====================================================
-- RLS: support_technicians
-- =====================================================
ALTER TABLE support_technicians ENABLE ROW LEVEL SECURITY;

-- Todos podem ver quem são os técnicos
CREATE POLICY "Anyone can view technicians"
ON support_technicians FOR SELECT
USING (true);

-- Apenas super_admin pode gerenciar técnicos
CREATE POLICY "Super admin can manage technicians"
ON support_technicians FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'super_admin'
  )
);

-- =====================================================
-- RPCs: Dashboard de Métricas
-- =====================================================

-- Métricas gerais do dashboard
CREATE OR REPLACE FUNCTION get_support_dashboard_metrics(
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  -- Verificar se é técnico
  IF NOT is_support_technician(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT json_build_object(
    'total_tickets', COUNT(*),
    'open_tickets', COUNT(*) FILTER (WHERE status = 'open'),
    'in_progress', COUNT(*) FILTER (WHERE status = 'in_progress'),
    'waiting_response', COUNT(*) FILTER (WHERE status = 'waiting_response'),
    'resolved', COUNT(*) FILTER (WHERE status = 'resolved'),
    'closed', COUNT(*) FILTER (WHERE status = 'closed'),
    'by_priority', json_build_object(
      'critical', COUNT(*) FILTER (WHERE priority = 'critical' AND status NOT IN ('resolved', 'closed')),
      'high', COUNT(*) FILTER (WHERE priority = 'high' AND status NOT IN ('resolved', 'closed')),
      'medium', COUNT(*) FILTER (WHERE priority = 'medium' AND status NOT IN ('resolved', 'closed')),
      'low', COUNT(*) FILTER (WHERE priority = 'low' AND status NOT IN ('resolved', 'closed'))
    ),
    'by_category', json_build_object(
      'bug', COUNT(*) FILTER (WHERE category = 'bug'),
      'feature', COUNT(*) FILTER (WHERE category = 'feature'),
      'question', COUNT(*) FILTER (WHERE category = 'question'),
      'improvement', COUNT(*) FILTER (WHERE category = 'improvement'),
      'performance', COUNT(*) FILTER (WHERE category = 'performance'),
      'security', COUNT(*) FILTER (WHERE category = 'security')
    ),
    'avg_resolution_hours', COALESCE(ROUND(
      EXTRACT(EPOCH FROM AVG(resolved_at - created_at) FILTER (WHERE resolved_at IS NOT NULL)) / 3600
    ), 0),
    'avg_first_response_hours', COALESCE(ROUND(
      EXTRACT(EPOCH FROM AVG(first_response_at - created_at) FILTER (WHERE first_response_at IS NOT NULL)) / 3600
    ), 0)
  ) INTO result
  FROM support_tickets
  WHERE (p_date_from IS NULL OR created_at >= p_date_from)
    AND (p_date_to IS NULL OR created_at <= p_date_to);
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Ranking de técnicos
CREATE OR REPLACE FUNCTION get_technician_ranking(
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  technician_id UUID,
  technician_name TEXT,
  tickets_assigned INTEGER,
  tickets_resolved INTEGER,
  avg_resolution_hours NUMERIC,
  avg_first_response_hours NUMERIC
) AS $$
BEGIN
  -- Verificar se é técnico
  IF NOT is_support_technician(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  SELECT 
    st.user_id,
    p.full_name,
    COUNT(t.id)::INTEGER,
    COUNT(*) FILTER (WHERE t.status IN ('resolved', 'closed'))::INTEGER,
    COALESCE(ROUND(EXTRACT(EPOCH FROM AVG(t.resolved_at - t.created_at) FILTER (WHERE t.resolved_at IS NOT NULL)) / 3600, 1), 0),
    COALESCE(ROUND(EXTRACT(EPOCH FROM AVG(t.first_response_at - t.created_at) FILTER (WHERE t.first_response_at IS NOT NULL)) / 3600, 1), 0)
  FROM support_technicians st
  JOIN profiles p ON p.id = st.user_id
  LEFT JOIN support_tickets t ON t.assigned_to = st.user_id
    AND (p_date_from IS NULL OR t.created_at >= p_date_from)
    AND (p_date_to IS NULL OR t.created_at <= p_date_to)
  WHERE st.is_active = true
  GROUP BY st.user_id, p.full_name
  ORDER BY COUNT(*) FILTER (WHERE t.status IN ('resolved', 'closed')) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Tickets por tenant
CREATE OR REPLACE FUNCTION get_tickets_by_tenant()
RETURNS TABLE (
  tenant_id UUID,
  tenant_name TEXT,
  total_tickets BIGINT,
  open_tickets BIGINT
) AS $$
BEGIN
  -- Verificar se é técnico
  IF NOT is_support_technician(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  SELECT 
    t.tenant_id,
    tn.name,
    COUNT(*),
    COUNT(*) FILTER (WHERE t.status NOT IN ('resolved', 'closed'))
  FROM support_tickets t
  JOIN tenants tn ON tn.id = t.tenant_id
  GROUP BY t.tenant_id, tn.name
  ORDER BY COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Evolução mensal de tickets
CREATE OR REPLACE FUNCTION get_tickets_evolution(p_months INTEGER DEFAULT 6)
RETURNS TABLE (
  month TEXT,
  created INTEGER,
  resolved INTEGER
) AS $$
BEGIN
  -- Verificar se é técnico
  IF NOT is_support_technician(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  SELECT 
    TO_CHAR(date_trunc('month', t.created_at), 'YYYY-MM') as month,
    COUNT(*)::INTEGER as created,
    COUNT(*) FILTER (WHERE t.resolved_at IS NOT NULL)::INTEGER as resolved
  FROM support_tickets t
  WHERE t.created_at >= NOW() - (p_months || ' months')::INTERVAL
  GROUP BY date_trunc('month', t.created_at)
  ORDER BY date_trunc('month', t.created_at);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;