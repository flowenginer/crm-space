-- Adicionar política de INSERT para internal_notes (corrige erro RLS para tenant Master)
CREATE POLICY "Authenticated users can create internal_notes"
  ON internal_notes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

COMMENT ON POLICY "Authenticated users can create internal_notes" ON internal_notes 
  IS 'Permite usuários autenticados criarem notas - tenant_id validado pela política RESTRICTIVE e trigger';