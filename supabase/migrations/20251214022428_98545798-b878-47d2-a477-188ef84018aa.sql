-- Add notification pause control columns to quotes table
ALTER TABLE quotes 
ADD COLUMN IF NOT EXISTS notifications_paused BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS notifications_paused_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS notifications_paused_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS notifications_auto_paused BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS notifications_auto_pause_reason TEXT;

-- Add index for notification queries
CREATE INDEX IF NOT EXISTS idx_quotes_notifications_status 
ON quotes(tenant_id, notifications_paused, notifications_auto_paused) 
WHERE status NOT IN ('converted', 'rejected', 'cancelled');

-- Add comment for documentation
COMMENT ON COLUMN quotes.notifications_paused IS 'Manual pause control by seller';
COMMENT ON COLUMN quotes.notifications_auto_paused IS 'Automatic pause when client responds or status changes';
COMMENT ON COLUMN quotes.notifications_auto_pause_reason IS 'Reason for auto-pause: client_responded, status_changed, converted';