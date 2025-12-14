-- Tabela de regras de visibilidade para e-mail interno
CREATE TABLE public.email_visibility_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_role text NOT NULL,        -- Quem está enviando (ex: 'vendedor')
  target_role text,                 -- Role que pode ver/receber (ex: 'designer')
  target_shared_box_id uuid REFERENCES email_shared_boxes(id) ON DELETE CASCADE,
  is_allowed boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(source_role, target_role),
  UNIQUE(source_role, target_shared_box_id)
);

-- Índices para performance
CREATE INDEX idx_email_visibility_rules_source ON email_visibility_rules(source_role);
CREATE INDEX idx_email_visibility_rules_target ON email_visibility_rules(target_role);

-- Enable RLS
ALTER TABLE public.email_visibility_rules ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admins can manage visibility rules"
ON public.email_visibility_rules
FOR ALL
USING (is_admin_or_supervisor(auth.uid()));

CREATE POLICY "All authenticated users can view rules"
ON public.email_visibility_rules
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Trigger para updated_at
CREATE TRIGGER update_email_visibility_rules_updated_at
BEFORE UPDATE ON public.email_visibility_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();