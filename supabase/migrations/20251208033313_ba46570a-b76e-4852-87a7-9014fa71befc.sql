-- Habilitar realtime na tabela contact_requests
ALTER TABLE contact_requests REPLICA IDENTITY FULL;

-- Adicionar tabela à publicação de realtime
ALTER PUBLICATION supabase_realtime ADD TABLE contact_requests;