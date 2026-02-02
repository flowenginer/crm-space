-- Adicionar políticas INSERT para conversation_tags e contact_tags
-- Mesmo padrão já aplicado a tags e internal_notes

CREATE POLICY "Authenticated users can create conversation_tags"
  ON conversation_tags FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create contact_tags"
  ON contact_tags FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

COMMENT ON POLICY "Authenticated users can create conversation_tags" ON conversation_tags
  IS 'Permite INSERT autenticado - tenant_id validado pela política RESTRICTIVE e trigger';
COMMENT ON POLICY "Authenticated users can create contact_tags" ON contact_tags
  IS 'Permite INSERT autenticado - tenant_id validado pela política RESTRICTIVE e trigger';