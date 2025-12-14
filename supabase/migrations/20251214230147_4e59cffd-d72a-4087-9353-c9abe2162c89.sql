-- Add columns to track sender deletion
ALTER TABLE internal_emails 
ADD COLUMN IF NOT EXISTS is_deleted_by_sender BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_by_sender_at TIMESTAMP WITH TIME ZONE;