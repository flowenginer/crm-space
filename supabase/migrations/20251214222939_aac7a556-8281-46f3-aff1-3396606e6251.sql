-- Permitir que todos usuários autenticados vejam caixas compartilhadas ativas
DROP POLICY IF EXISTS "Users can view shared boxes they are members of" ON email_shared_boxes;

CREATE POLICY "All authenticated users can view active shared boxes" 
ON email_shared_boxes FOR SELECT 
USING (is_active = true AND auth.uid() IS NOT NULL);