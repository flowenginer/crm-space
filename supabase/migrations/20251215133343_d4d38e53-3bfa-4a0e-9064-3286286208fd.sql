-- Criar tabela de segmentos
CREATE TABLE public.segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT DEFAULT '#6366F1',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Adicionar campo segment_id na tabela contacts
ALTER TABLE public.contacts ADD COLUMN segment_id UUID REFERENCES public.segments(id);

-- Criar índices para performance
CREATE INDEX idx_contacts_segment_id ON public.contacts(segment_id);
CREATE INDEX idx_segments_name ON public.segments(name);
CREATE INDEX idx_segments_is_active ON public.segments(is_active);

-- RLS para segments
ALTER TABLE public.segments ENABLE ROW LEVEL SECURITY;

-- Política de leitura - todos autenticados podem ver
CREATE POLICY "Anyone authenticated can view segments"
ON public.segments FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Política de escrita - admin/supervisor podem gerenciar
CREATE POLICY "Admins and supervisors can manage segments"
ON public.segments FOR ALL
USING (is_admin_or_supervisor(auth.uid()));

-- Trigger para updated_at
CREATE TRIGGER update_segments_updated_at
  BEFORE UPDATE ON public.segments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();