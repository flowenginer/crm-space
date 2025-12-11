-- Remove TODAS as políticas existentes da tabela internal_chat_participants
DROP POLICY IF EXISTS "Users can insert participants" ON internal_chat_participants;
DROP POLICY IF EXISTS "Users can update own participation" ON internal_chat_participants;
DROP POLICY IF EXISTS "Users can view participants of own threads" ON internal_chat_participants;
DROP POLICY IF EXISTS "simple_select_own_participations" ON internal_chat_participants;
DROP POLICY IF EXISTS "simple_update_own_participations" ON internal_chat_participants;
DROP POLICY IF EXISTS "simple_insert_participations" ON internal_chat_participants;
DROP POLICY IF EXISTS "select_own_participations" ON internal_chat_participants;
DROP POLICY IF EXISTS "insert_participations" ON internal_chat_participants;
DROP POLICY IF EXISTS "update_own_participations" ON internal_chat_participants;

-- Cria políticas SIMPLES sem recursão
CREATE POLICY "select_own_participations" ON internal_chat_participants
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "insert_participations" ON internal_chat_participants
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "update_own_participations" ON internal_chat_participants
FOR UPDATE USING (user_id = auth.uid());