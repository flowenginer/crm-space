-- Add trigger_processed column to messages table for idempotent trigger processing
ALTER TABLE messages ADD COLUMN IF NOT EXISTS trigger_processed BOOLEAN DEFAULT FALSE;

-- Create index for efficient queries on unprocessed messages
CREATE INDEX IF NOT EXISTS idx_messages_trigger_processed ON messages (trigger_processed) WHERE trigger_processed = FALSE;

-- Add comment for documentation
COMMENT ON COLUMN messages.trigger_processed IS 'Indicates if process-flow-triggers was invoked for this message. Prevents duplicate trigger processing in race conditions.';