-- Habilitar REPLICA IDENTITY FULL na tabela messages
-- Isso garante que eventos Realtime de UPDATE/DELETE enviem todos os campos, não apenas a primary key
ALTER TABLE public.messages REPLICA IDENTITY FULL;