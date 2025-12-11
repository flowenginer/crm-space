-- Alterar constraint de messages para CASCADE
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_contact_id_fkey;
ALTER TABLE messages 
ADD CONSTRAINT messages_contact_id_fkey 
FOREIGN KEY (contact_id) 
REFERENCES contacts(id) 
ON DELETE CASCADE;

-- Alterar constraint de deals para SET NULL
ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_contact_id_fkey;
ALTER TABLE deals 
ADD CONSTRAINT deals_contact_id_fkey 
FOREIGN KEY (contact_id) 
REFERENCES contacts(id) 
ON DELETE SET NULL;