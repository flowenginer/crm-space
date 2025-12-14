-- Add new configuration fields to tenant_notification_config
ALTER TABLE tenant_notification_config
ADD COLUMN IF NOT EXISTS notification_send_time TIME DEFAULT '09:00',
ADD COLUMN IF NOT EXISTS daily_limit INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS min_interval_hours INTEGER DEFAULT 24,
ADD COLUMN IF NOT EXISTS pause_on_weekends BOOLEAN DEFAULT false;

-- Add index for faster quote notification queries
CREATE INDEX IF NOT EXISTS idx_quotes_expiring 
ON quotes (tenant_id, status, valid_until) 
WHERE status IN ('sent', 'approved');

-- Add index for notification history
CREATE INDEX IF NOT EXISTS idx_quote_notifications_tenant 
ON quote_expiration_notifications (tenant_id, created_at DESC);