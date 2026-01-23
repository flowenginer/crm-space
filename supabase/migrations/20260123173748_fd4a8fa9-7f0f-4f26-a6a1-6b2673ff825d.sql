-- Add transcription columns to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS transcription TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS transcription_status TEXT DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN messages.transcription IS 'Transcrição do áudio via Google Gemini';
COMMENT ON COLUMN messages.transcription_status IS 'Status: pending, processing, completed, error';

-- Create partial index for efficient querying of pending audio messages (Space Sports only)
CREATE INDEX IF NOT EXISTS idx_messages_audio_pending_space 
ON messages (tenant_id, created_at) 
WHERE message_type = 'audio' 
AND transcription_status = 'pending'
AND tenant_id = '00000000-0000-0000-0000-000000000001';

-- Create trigger function to mark new audio messages for transcription (Space Sports only)
CREATE OR REPLACE FUNCTION mark_audio_for_transcription()
RETURNS TRIGGER AS $$
BEGIN
  -- Only mark for transcription if:
  -- 1. It's from Space Sports tenant
  -- 2. It's an audio message
  -- 3. It has a media_url
  IF NEW.tenant_id = '00000000-0000-0000-0000-000000000001' 
     AND NEW.message_type = 'audio' 
     AND NEW.media_url IS NOT NULL THEN
    NEW.transcription_status := 'pending';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trg_mark_audio_transcription ON messages;
CREATE TRIGGER trg_mark_audio_transcription
BEFORE INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION mark_audio_for_transcription();