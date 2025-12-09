-- Remover restrição de MIME types do bucket conversation-attachments
-- Isso permite aceitar QUALQUER tipo de arquivo (CorelDRAW, Photoshop, ZIP, etc.)
UPDATE storage.buckets 
SET allowed_mime_types = NULL
WHERE id = 'conversation-attachments';

-- Também atualizar o bucket template-attachments para aceitar qualquer tipo
UPDATE storage.buckets 
SET allowed_mime_types = NULL
WHERE id = 'template-attachments';