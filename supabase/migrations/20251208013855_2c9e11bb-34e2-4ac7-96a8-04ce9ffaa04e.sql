-- =====================================================
-- FASE 0: Configuração de Métrica de Conversão
-- =====================================================

-- Adicionar campo de configuração de conversão na company_settings
-- Padrão: "07 - Pedido Fechado" (UUID do status)
ALTER TABLE company_settings 
ADD COLUMN IF NOT EXISTS conversion_status_ids UUID[] 
DEFAULT ARRAY['78f16fc9-39f5-47ff-9774-00a0af9fa7da'::uuid];

-- =====================================================
-- FASE 1: Estrutura de Dados para Rastreamento
-- =====================================================

-- 1.1 Criar tabela lead_status_history
-- Registra cada mudança de status do lead com timestamps
CREATE TABLE IF NOT EXISTS lead_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_seconds INTEGER, -- tempo que ficou no status anterior
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_lead_status_history_contact ON lead_status_history(contact_id);
CREATE INDEX IF NOT EXISTS idx_lead_status_history_new_status ON lead_status_history(new_status);
CREATE INDEX IF NOT EXISTS idx_lead_status_history_changed_at ON lead_status_history(changed_at);
CREATE INDEX IF NOT EXISTS idx_lead_status_history_contact_changed ON lead_status_history(contact_id, changed_at DESC);

-- RLS para lead_status_history
ALTER TABLE lead_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated access lead_status_history" 
ON lead_status_history FOR ALL 
USING (auth.uid() IS NOT NULL);

-- 1.2 Criar tabela lead_assignment_history
-- Registra quando leads são atribuídos a vendedores
CREATE TABLE IF NOT EXISTS lead_assignment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  assigned_from UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assignment_type TEXT DEFAULT 'manual', -- 'first_assignment', 'transfer', 'reopen', 'auto'
  time_to_assign_seconds INTEGER, -- tempo desde entrada até atribuição
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_lead_assignment_contact ON lead_assignment_history(contact_id);
CREATE INDEX IF NOT EXISTS idx_lead_assignment_to ON lead_assignment_history(assigned_to);
CREATE INDEX IF NOT EXISTS idx_lead_assignment_at ON lead_assignment_history(assigned_at);
CREATE INDEX IF NOT EXISTS idx_lead_assignment_type ON lead_assignment_history(assignment_type);
CREATE INDEX IF NOT EXISTS idx_lead_assignment_contact_at ON lead_assignment_history(contact_id, assigned_at DESC);

-- RLS para lead_assignment_history
ALTER TABLE lead_assignment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated access lead_assignment_history" 
ON lead_assignment_history FOR ALL 
USING (auth.uid() IS NOT NULL);

-- =====================================================
-- TRIGGERS PARA RASTREAMENTO AUTOMÁTICO
-- =====================================================

-- 1.3 Trigger para rastrear mudanças de status do lead
CREATE OR REPLACE FUNCTION track_lead_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_duration INTEGER;
BEGIN
  -- Só registra se o status realmente mudou
  IF OLD.lead_status IS DISTINCT FROM NEW.lead_status THEN
    -- Calcular duração no status anterior (em segundos)
    v_duration := EXTRACT(EPOCH FROM (NOW() - COALESCE(OLD.updated_at, OLD.created_at)))::INTEGER;
    
    INSERT INTO lead_status_history (
      contact_id, 
      previous_status, 
      new_status, 
      changed_by,
      duration_seconds
    )
    VALUES (
      NEW.id,
      OLD.lead_status,
      NEW.lead_status,
      auth.uid(),
      v_duration
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar trigger na tabela contacts
DROP TRIGGER IF EXISTS on_lead_status_change ON contacts;
CREATE TRIGGER on_lead_status_change
  BEFORE UPDATE OF lead_status ON contacts
  FOR EACH ROW EXECUTE FUNCTION track_lead_status_change();

-- 1.4 Trigger para rastrear atribuições de conversas
CREATE OR REPLACE FUNCTION track_conversation_assignment()
RETURNS TRIGGER AS $$
DECLARE
  v_time_to_assign INTEGER;
  v_assignment_type TEXT;
BEGIN
  -- Só registra se assigned_to mudou e o novo valor não é nulo
  IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to AND NEW.assigned_to IS NOT NULL THEN
    -- Calcular tempo desde criação da conversa até atribuição
    v_time_to_assign := EXTRACT(EPOCH FROM (NOW() - NEW.created_at))::INTEGER;
    
    -- Determinar tipo de atribuição
    IF OLD.assigned_to IS NULL THEN
      v_assignment_type := 'first_assignment';
    ELSIF NEW.status = 'open' AND OLD.status = 'closed' THEN
      v_assignment_type := 'reopen';
    ELSE
      v_assignment_type := 'transfer';
    END IF;
    
    INSERT INTO lead_assignment_history (
      contact_id,
      conversation_id,
      assigned_from,
      assigned_to,
      assigned_by,
      assignment_type,
      time_to_assign_seconds
    )
    VALUES (
      NEW.contact_id,
      NEW.id,
      OLD.assigned_to,
      NEW.assigned_to,
      auth.uid(),
      v_assignment_type,
      v_time_to_assign
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar trigger na tabela conversations
DROP TRIGGER IF EXISTS on_conversation_assignment ON conversations;
CREATE TRIGGER on_conversation_assignment
  BEFORE UPDATE OF assigned_to ON conversations
  FOR EACH ROW EXECUTE FUNCTION track_conversation_assignment();