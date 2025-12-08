-- =====================================================
-- PARTE 1: Tabela de Múltiplos Departamentos por Usuário
-- =====================================================

CREATE TABLE public.user_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, department_id)
);

-- Índices para performance
CREATE INDEX idx_user_departments_user ON public.user_departments(user_id);
CREATE INDEX idx_user_departments_department ON public.user_departments(department_id);

-- RLS
ALTER TABLE public.user_departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view user_departments"
ON public.user_departments FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage user_departments"
ON public.user_departments FOR ALL
USING (is_admin_or_supervisor(auth.uid()));

-- =====================================================
-- PARTE 2: Tabela de Requisições de Contato
-- =====================================================

CREATE TABLE public.contact_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  current_owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  request_type TEXT NOT NULL CHECK (request_type IN ('owner', 'attendant')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reason TEXT,
  response_note TEXT,
  responded_by UUID REFERENCES public.profiles(id),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX idx_contact_requests_status ON public.contact_requests(status);
CREATE INDEX idx_contact_requests_requester ON public.contact_requests(requester_id);
CREATE INDEX idx_contact_requests_contact ON public.contact_requests(contact_id);

-- RLS
ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;

-- Usuários podem ver suas próprias requisições
CREATE POLICY "Users can view own requests"
ON public.contact_requests FOR SELECT
USING (requester_id = auth.uid());

-- Admin/Supervisor podem ver todas as requisições
CREATE POLICY "Admins can view all requests"
ON public.contact_requests FOR SELECT
USING (is_admin_or_supervisor(auth.uid()));

-- Usuários podem criar requisições
CREATE POLICY "Users can create requests"
ON public.contact_requests FOR INSERT
WITH CHECK (auth.uid() = requester_id);

-- Admin/Supervisor podem atualizar requisições (aprovar/rejeitar)
CREATE POLICY "Admins can update requests"
ON public.contact_requests FOR UPDATE
USING (is_admin_or_supervisor(auth.uid()));

-- =====================================================
-- PARTE 3: Função para verificar departamento do usuário
-- =====================================================

CREATE OR REPLACE FUNCTION public.user_has_department(_user_id UUID, _department_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_departments
    WHERE user_id = _user_id
      AND department_id = _department_id
  )
$$;

-- Função para obter departamentos do usuário
CREATE OR REPLACE FUNCTION public.get_user_department_ids(_user_id UUID)
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(department_id), ARRAY[]::UUID[])
  FROM public.user_departments
  WHERE user_id = _user_id
$$;

-- =====================================================
-- PARTE 4: Migrar dados existentes (department_id do profiles)
-- =====================================================

INSERT INTO public.user_departments (user_id, department_id, is_primary)
SELECT id, department_id, true
FROM public.profiles
WHERE department_id IS NOT NULL
ON CONFLICT (user_id, department_id) DO NOTHING;

-- =====================================================
-- PARTE 5: Trigger para updated_at
-- =====================================================

CREATE TRIGGER update_contact_requests_updated_at
BEFORE UPDATE ON public.contact_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();