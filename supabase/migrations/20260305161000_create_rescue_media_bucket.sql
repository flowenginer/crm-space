-- Increase conversation-attachments bucket size limit to 50MB to support video uploads in marketing campaigns
UPDATE storage.buckets
SET file_size_limit = 52428800
WHERE id = 'conversation-attachments';
