-- Criar tabela para histórico de importações de contatos
CREATE TABLE public.import_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  
  -- Informações da fonte
  source_type TEXT NOT NULL, -- 'file' ou 'google_sheets'
  source_name TEXT NOT NULL, -- Nome do arquivo ou URL da planilha
  
  -- Estatísticas
  total_rows INTEGER DEFAULT 0,
  processed INTEGER DEFAULT 0,
  created INTEGER DEFAULT 0,
  updated INTEGER DEFAULT 0,
  skipped INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  tags_created INTEGER DEFAULT 0,
  tags_assigned INTEGER DEFAULT 0,
  
  -- Status
  status TEXT DEFAULT 'completed', -- 'completed', 'partial', 'failed'
  
  -- Log detalhado (opcional, para debug)
  log JSONB DEFAULT '[]'
);

-- Habilitar RLS
ALTER TABLE public.import_history ENABLE ROW LEVEL SECURITY;

-- Política: usuários autenticados podem ver e criar histórico
CREATE POLICY "Authenticated access import_history" 
ON public.import_history 
FOR ALL 
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Índice para busca por usuário e data
CREATE INDEX idx_import_history_created_by ON public.import_history(created_by);
CREATE INDEX idx_import_history_created_at ON public.import_history(created_at DESC);