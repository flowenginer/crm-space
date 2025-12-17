-- =============================================
-- SISTEMA DE RESGATE DE LEADS
-- =============================================

-- Tabela de templates de resgate
CREATE TABLE public.rescue_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- steps format: [{ "message": "texto", "timer_minutes": 10 }, ...]
  final_action TEXT NOT NULL DEFAULT 'close',
  -- 'close' | 'transfer' | 'none'
  final_action_config JSONB DEFAULT '{}'::jsonb,
  -- { "close_reason_id": "uuid" } ou { "department_id": "uuid" }
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de resgates ativos
CREATE TABLE public.active_rescues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES rescue_templates(id),
  current_step INTEGER DEFAULT 0,
  next_send_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active',
  -- 'active' | 'completed' | 'cancelled' | 'responded'
  activated_by UUID REFERENCES profiles(id),
  cancelled_by UUID REFERENCES profiles(id),
  cancelled_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(conversation_id, status) -- Apenas um resgate ativo por conversa
);

-- Tabela de mensagens agendadas do resgate
CREATE TABLE public.rescue_scheduled_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rescue_id UUID NOT NULL REFERENCES active_rescues(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  content TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending',
  -- 'pending' | 'sent' | 'cancelled'
  sent_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_active_rescues_conversation ON active_rescues(conversation_id);
CREATE INDEX idx_active_rescues_status ON active_rescues(status);
CREATE INDEX idx_active_rescues_next_send ON active_rescues(next_send_at) WHERE status = 'active';
CREATE INDEX idx_rescue_scheduled_pending ON rescue_scheduled_messages(scheduled_for) WHERE status = 'pending';
CREATE INDEX idx_rescue_scheduled_rescue ON rescue_scheduled_messages(rescue_id);

-- Trigger para updated_at
CREATE TRIGGER update_rescue_templates_updated_at
  BEFORE UPDATE ON rescue_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_active_rescues_updated_at
  BEFORE UPDATE ON active_rescues
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS para rescue_templates
ALTER TABLE rescue_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view rescue templates"
  ON rescue_templates FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage rescue templates"
  ON rescue_templates FOR ALL
  USING (is_admin_or_supervisor(auth.uid()));

-- RLS para active_rescues
ALTER TABLE active_rescues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view rescues for their conversations"
  ON active_rescues FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND (
      is_admin_or_supervisor(auth.uid())
      OR EXISTS (
        SELECT 1 FROM conversations c 
        WHERE c.id = active_rescues.conversation_id 
        AND (c.assigned_to = auth.uid() OR c.assigned_to IS NULL)
      )
    )
  );

CREATE POLICY "Users can create rescues for their conversations"
  ON active_rescues FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND (
      is_admin_or_supervisor(auth.uid())
      OR EXISTS (
        SELECT 1 FROM conversations c 
        WHERE c.id = conversation_id 
        AND (c.assigned_to = auth.uid() OR c.assigned_to IS NULL)
      )
    )
  );

CREATE POLICY "Users can update rescues for their conversations"
  ON active_rescues FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND (
      is_admin_or_supervisor(auth.uid())
      OR EXISTS (
        SELECT 1 FROM conversations c 
        WHERE c.id = active_rescues.conversation_id 
        AND (c.assigned_to = auth.uid() OR c.assigned_to IS NULL)
      )
    )
  );

-- RLS para rescue_scheduled_messages
ALTER TABLE rescue_scheduled_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view scheduled messages for their rescues"
  ON rescue_scheduled_messages FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND (
      is_admin_or_supervisor(auth.uid())
      OR EXISTS (
        SELECT 1 FROM active_rescues ar
        JOIN conversations c ON c.id = ar.conversation_id
        WHERE ar.id = rescue_scheduled_messages.rescue_id
        AND (c.assigned_to = auth.uid() OR c.assigned_to IS NULL)
      )
    )
  );

CREATE POLICY "Users can manage scheduled messages for their rescues"
  ON rescue_scheduled_messages FOR ALL
  USING (
    auth.uid() IS NOT NULL AND (
      is_admin_or_supervisor(auth.uid())
      OR EXISTS (
        SELECT 1 FROM active_rescues ar
        JOIN conversations c ON c.id = ar.conversation_id
        WHERE ar.id = rescue_scheduled_messages.rescue_id
        AND (c.assigned_to = auth.uid() OR c.assigned_to IS NULL)
      )
    )
  );

-- Função para cancelar resgate quando lead responder
CREATE OR REPLACE FUNCTION public.cancel_rescue_on_lead_response()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se a mensagem é do lead (não é from_me)
  IF NEW.is_from_me = false THEN
    -- Cancelar resgates ativos para esta conversa
    UPDATE active_rescues
    SET 
      status = 'responded',
      responded_at = now(),
      updated_at = now()
    WHERE conversation_id = NEW.conversation_id
      AND status = 'active';
    
    -- Cancelar mensagens pendentes
    UPDATE rescue_scheduled_messages rsm
    SET 
      status = 'cancelled',
      cancelled_at = now()
    FROM active_rescues ar
    WHERE rsm.rescue_id = ar.id
      AND ar.conversation_id = NEW.conversation_id
      AND rsm.status = 'pending';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para cancelar resgate quando lead responder
CREATE TRIGGER trigger_cancel_rescue_on_response
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION cancel_rescue_on_lead_response();