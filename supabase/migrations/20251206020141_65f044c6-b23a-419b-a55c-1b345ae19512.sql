-- Remove a constraint fixa de roles para permitir roles dinâmicos
-- Os roles agora são gerenciados pela tabela role_definitions
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;