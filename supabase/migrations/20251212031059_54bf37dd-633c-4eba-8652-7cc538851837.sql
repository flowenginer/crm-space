-- Habilitar RLS na tabela space_memory que está sem proteção
ALTER TABLE public.space_memory ENABLE ROW LEVEL SECURITY;

-- Criar política de acesso apenas para usuários autenticados
CREATE POLICY "Authenticated users can access space_memory"
ON public.space_memory
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);