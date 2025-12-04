-- Habilitar REPLICA IDENTITY FULL para capturar dados completos nas atualizações
ALTER TABLE messages REPLICA IDENTITY FULL;
ALTER TABLE conversations REPLICA IDENTITY FULL;

-- Adicionar tabelas à publicação supabase_realtime para habilitar real-time
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;