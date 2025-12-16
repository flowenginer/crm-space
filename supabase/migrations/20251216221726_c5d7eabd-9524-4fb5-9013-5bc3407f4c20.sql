-- Remover política restritiva atual que só permite admin/supervisor
DROP POLICY IF EXISTS "Admins and supervisors can manage segments" ON segments;

-- Criar nova política que permite qualquer usuário autenticado gerenciar segmentos
CREATE POLICY "Authenticated users can manage segments"
  ON segments
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);