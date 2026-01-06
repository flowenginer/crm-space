-- Remover constraint NOT NULL de template_id para permitir disparos de Marketing
ALTER TABLE bulk_dispatches 
ALTER COLUMN template_id DROP NOT NULL;