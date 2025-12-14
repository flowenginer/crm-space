-- Criar tabela de caixas de e-mail compartilhadas
CREATE TABLE IF NOT EXISTS public.email_shared_boxes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE,
  distribution_type TEXT NOT NULL DEFAULT 'claim',
  current_position INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Membros da caixa compartilhada
CREATE TABLE IF NOT EXISTS public.email_shared_box_members (
  shared_box_id UUID NOT NULL REFERENCES public.email_shared_boxes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  order_position INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  PRIMARY KEY (shared_box_id, user_id)
);

-- Adicionar campos na tabela de e-mails (com IF NOT EXISTS para evitar erro)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'internal_emails' AND column_name = 'shared_box_id') THEN
    ALTER TABLE public.internal_emails ADD COLUMN shared_box_id UUID REFERENCES public.email_shared_boxes(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'internal_emails' AND column_name = 'claimed_by') THEN
    ALTER TABLE public.internal_emails ADD COLUMN claimed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'internal_emails' AND column_name = 'claimed_at') THEN
    ALTER TABLE public.internal_emails ADD COLUMN claimed_at TIMESTAMP WITH TIME ZONE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'internal_emails' AND column_name = 'workflow_status') THEN
    ALTER TABLE public.internal_emails ADD COLUMN workflow_status TEXT DEFAULT 'pending';
  END IF;
END $$;

-- Tabela de log de atividades do e-mail
CREATE TABLE IF NOT EXISTS public.email_activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email_id UUID NOT NULL REFERENCES public.internal_emails(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_email_shared_boxes_department ON public.email_shared_boxes(department_id);
CREATE INDEX IF NOT EXISTS idx_email_shared_box_members_user ON public.email_shared_box_members(user_id);
CREATE INDEX IF NOT EXISTS idx_internal_emails_shared_box ON public.internal_emails(shared_box_id);
CREATE INDEX IF NOT EXISTS idx_internal_emails_claimed_by ON public.internal_emails(claimed_by);
CREATE INDEX IF NOT EXISTS idx_internal_emails_workflow_status ON public.internal_emails(workflow_status);
CREATE INDEX IF NOT EXISTS idx_email_activity_log_email ON public.email_activity_log(email_id);
CREATE INDEX IF NOT EXISTS idx_email_activity_log_actor ON public.email_activity_log(actor_id);

-- RLS para email_shared_boxes
ALTER TABLE public.email_shared_boxes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view shared boxes they are members of" ON public.email_shared_boxes;
CREATE POLICY "Users can view shared boxes they are members of"
ON public.email_shared_boxes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.email_shared_box_members
    WHERE shared_box_id = email_shared_boxes.id AND user_id = auth.uid()
  )
  OR is_admin_or_supervisor(auth.uid())
);

DROP POLICY IF EXISTS "Admins can manage shared boxes" ON public.email_shared_boxes;
CREATE POLICY "Admins can manage shared boxes"
ON public.email_shared_boxes FOR ALL
USING (is_admin_or_supervisor(auth.uid()));

-- RLS para email_shared_box_members
ALTER TABLE public.email_shared_box_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own memberships" ON public.email_shared_box_members;
CREATE POLICY "Users can view their own memberships"
ON public.email_shared_box_members FOR SELECT
USING (user_id = auth.uid() OR is_admin_or_supervisor(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage memberships" ON public.email_shared_box_members;
CREATE POLICY "Admins can manage memberships"
ON public.email_shared_box_members FOR ALL
USING (is_admin_or_supervisor(auth.uid()));

-- RLS para email_activity_log
ALTER TABLE public.email_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view activity of emails they have access to" ON public.email_activity_log;
CREATE POLICY "Users can view activity of emails they have access to"
ON public.email_activity_log FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.internal_emails e
    WHERE e.id = email_activity_log.email_id
    AND (
      e.sender_id = auth.uid()
      OR e.claimed_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.internal_email_recipients r
        WHERE r.email_id = e.id AND r.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.email_shared_box_members m
        WHERE m.shared_box_id = e.shared_box_id AND m.user_id = auth.uid()
      )
    )
  )
);

DROP POLICY IF EXISTS "Users can create activity logs" ON public.email_activity_log;
CREATE POLICY "Users can create activity logs"
ON public.email_activity_log FOR INSERT
WITH CHECK (actor_id = auth.uid());

-- Política adicional para internal_emails - membros de caixa compartilhada podem ver
DROP POLICY IF EXISTS "Shared box members can view shared emails" ON public.internal_emails;
CREATE POLICY "Shared box members can view shared emails"
ON public.internal_emails FOR SELECT
USING (
  shared_box_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.email_shared_box_members
    WHERE shared_box_id = internal_emails.shared_box_id AND user_id = auth.uid()
  )
);

-- Política para membros poderem assumir e-mails
DROP POLICY IF EXISTS "Shared box members can claim emails" ON public.internal_emails;
CREATE POLICY "Shared box members can claim emails"
ON public.internal_emails FOR UPDATE
USING (
  shared_box_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.email_shared_box_members
    WHERE shared_box_id = internal_emails.shared_box_id AND user_id = auth.uid()
  )
);

-- Função para registrar atividade automaticamente
CREATE OR REPLACE FUNCTION log_email_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.claimed_by IS NOT NULL AND OLD.claimed_by IS NULL THEN
    INSERT INTO public.email_activity_log (email_id, action, actor_id, details)
    VALUES (NEW.id, 'claimed', NEW.claimed_by, '{}'::jsonb);
  END IF;
  
  IF NEW.workflow_status IS DISTINCT FROM OLD.workflow_status THEN
    INSERT INTO public.email_activity_log (email_id, action, actor_id, details)
    VALUES (NEW.id, NEW.workflow_status, COALESCE(NEW.claimed_by, auth.uid()), 
      jsonb_build_object('old_status', OLD.workflow_status, 'new_status', NEW.workflow_status));
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_email_activity ON public.internal_emails;
CREATE TRIGGER trigger_log_email_activity
AFTER UPDATE ON public.internal_emails
FOR EACH ROW
EXECUTE FUNCTION log_email_activity();

-- Inserir caixa compartilhada de Designers
INSERT INTO public.email_shared_boxes (name, description, department_id, distribution_type)
SELECT 'Designers', 'Caixa compartilhada para solicitações de layout', id, 'claim'
FROM public.departments
WHERE LOWER(name) LIKE '%design%'
LIMIT 1
ON CONFLICT DO NOTHING;