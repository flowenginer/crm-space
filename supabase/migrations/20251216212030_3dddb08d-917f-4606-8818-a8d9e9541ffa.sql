-- Habilitar RLS na tabela de log
ALTER TABLE public.contact_merge_log ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ver o log de mesclagem
CREATE POLICY "Admins can view merge log" ON public.contact_merge_log
  FOR SELECT USING (is_admin_or_supervisor(auth.uid()));