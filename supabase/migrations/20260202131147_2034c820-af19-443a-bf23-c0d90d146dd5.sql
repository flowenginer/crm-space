-- Adicionar política de INSERT para tags (igual a contacts)
CREATE POLICY "Authenticated users can create tags"
  ON tags FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

COMMENT ON POLICY "Authenticated users can create tags" ON tags 
  IS 'Permite usuários autenticados criarem tags - tenant_id validado pela política RESTRICTIVE';