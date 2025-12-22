-- Permitir channel_id nulo para indicar "usar canal da conversa existente"
ALTER TABLE bulk_dispatches 
ALTER COLUMN channel_id DROP NOT NULL;