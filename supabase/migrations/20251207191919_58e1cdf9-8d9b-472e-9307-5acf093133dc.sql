-- Add media_name column to store original filename
ALTER TABLE message_templates ADD COLUMN media_name TEXT DEFAULT NULL;