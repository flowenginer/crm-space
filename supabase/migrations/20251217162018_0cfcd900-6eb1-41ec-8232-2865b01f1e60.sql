-- ==========================================
-- Tabela de regras de campos obrigatórios
-- ==========================================

CREATE TABLE public.required_fields_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Escopo da regra (departamento OU usuário, não ambos)
  department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Configurações
  is_enabled BOOLEAN DEFAULT true NOT NULL,
  required_fields TEXT[] DEFAULT '{}' NOT NULL,
  
  -- Metadados
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_by UUID REFERENCES public.profiles(id),
  
  -- Garantir apenas uma regra por departamento ou por usuário
  CONSTRAINT check_scope CHECK (
    (department_id IS NOT NULL AND user_id IS NULL) OR 
    (department_id IS NULL AND user_id IS NOT NULL)
  )
);

-- Índices únicos parciais para garantir uma regra por entidade
CREATE UNIQUE INDEX unique_department_rule ON public.required_fields_rules (department_id) WHERE department_id IS NOT NULL;
CREATE UNIQUE INDEX unique_user_rule ON public.required_fields_rules (user_id) WHERE user_id IS NOT NULL;

-- Índices para performance
CREATE INDEX idx_required_fields_rules_department ON public.required_fields_rules(department_id);
CREATE INDEX idx_required_fields_rules_user ON public.required_fields_rules(user_id);
CREATE INDEX idx_required_fields_rules_enabled ON public.required_fields_rules(is_enabled);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_required_fields_rules_updated_at
BEFORE UPDATE ON public.required_fields_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.required_fields_rules ENABLE ROW LEVEL SECURITY;

-- Policy: Admins e supervisores podem gerenciar
CREATE POLICY "Admins can manage required fields rules" 
ON public.required_fields_rules 
FOR ALL 
USING (public.is_admin_or_supervisor(auth.uid()));

-- Policy: Todos autenticados podem ler (necessário para validação)
CREATE POLICY "Authenticated users can read required fields rules" 
ON public.required_fields_rules 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Comentários
COMMENT ON TABLE public.required_fields_rules IS 'Regras de campos obrigatórios para envio de mensagens';
COMMENT ON COLUMN public.required_fields_rules.required_fields IS 'Array de campos obrigatórios: negotiated_value, lead_status, segment_id, owner_agent';