-- =============================================
-- ATUALIZAR TABELA DE TAGS COM VISIBILIDADE
-- =============================================

-- Adicionar coluna de visibilidade
ALTER TABLE public.tags 
ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'public';

-- Adicionar constraint para visibilidade
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tags_visibility_check'
  ) THEN
    ALTER TABLE public.tags ADD CONSTRAINT tags_visibility_check 
    CHECK (visibility IN ('public', 'private', 'department'));
  END IF;
END $$;

-- Adicionar coluna de criador
ALTER TABLE public.tags 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id);

-- Adicionar coluna de departamento (para visibilidade por departamento)
ALTER TABLE public.tags 
ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_tags_visibility ON public.tags(visibility);
CREATE INDEX IF NOT EXISTS idx_tags_created_by ON public.tags(created_by);
CREATE INDEX IF NOT EXISTS idx_tags_department ON public.tags(department_id);