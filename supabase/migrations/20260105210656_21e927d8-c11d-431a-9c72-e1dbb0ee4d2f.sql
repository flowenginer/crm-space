-- Habilitar REPLICA IDENTITY FULL para contact_tags
ALTER TABLE contact_tags REPLICA IDENTITY FULL;

-- Habilitar REPLICA IDENTITY FULL para contacts  
ALTER TABLE contacts REPLICA IDENTITY FULL;

-- Adicionar contact_tags à publicação de realtime
ALTER PUBLICATION supabase_realtime ADD TABLE contact_tags;

-- Adicionar contacts à publicação de realtime
ALTER PUBLICATION supabase_realtime ADD TABLE contacts;