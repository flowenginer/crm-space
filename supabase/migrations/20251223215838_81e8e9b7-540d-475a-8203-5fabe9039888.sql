-- Habilitar REPLICA IDENTITY FULL para capturar todos os dados nas mudanças
ALTER TABLE tenant_modules REPLICA IDENTITY FULL;

-- Adicionar ao publication de realtime para propagar mudanças em tempo real
ALTER PUBLICATION supabase_realtime ADD TABLE tenant_modules;