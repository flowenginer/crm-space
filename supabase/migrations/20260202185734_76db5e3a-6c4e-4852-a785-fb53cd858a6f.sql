-- Add sdp_answer column to call_logs for reliable SDP fallback
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS sdp_answer TEXT;

-- Add index for faster lookup by whatsapp_call_id (already might exist but safe to add)
CREATE INDEX IF NOT EXISTS idx_call_logs_whatsapp_call_id ON call_logs(whatsapp_call_id);