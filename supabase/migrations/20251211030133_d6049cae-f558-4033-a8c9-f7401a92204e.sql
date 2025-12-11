-- Tornar o bucket de anexos do chat interno público para que áudios possam ser reproduzidos
UPDATE storage.buckets 
SET public = true 
WHERE id = 'internal-chat-attachments';

-- Adicionar política de acesso público de leitura
CREATE POLICY "Acesso público de leitura aos anexos do chat interno"
ON storage.objects FOR SELECT
USING (bucket_id = 'internal-chat-attachments');