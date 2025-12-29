-- Alterar a foreign key de redirect_logs para permitir exclusão de contatos
ALTER TABLE redirect_logs DROP CONSTRAINT redirect_logs_contact_id_fkey;

ALTER TABLE redirect_logs 
ADD CONSTRAINT redirect_logs_contact_id_fkey 
FOREIGN KEY (contact_id) 
REFERENCES contacts(id) 
ON DELETE SET NULL;