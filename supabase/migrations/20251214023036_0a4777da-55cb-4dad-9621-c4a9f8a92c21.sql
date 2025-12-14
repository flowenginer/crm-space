-- Add new columns for enhanced notification configuration
ALTER TABLE tenant_notification_config 
ADD COLUMN IF NOT EXISTS notification_trigger_type TEXT DEFAULT 'before_expiry';

ALTER TABLE tenant_notification_config 
ADD COLUMN IF NOT EXISTS notification_send_times TEXT[] DEFAULT ARRAY['09:00']::TEXT[];

ALTER TABLE tenant_notification_config 
ADD COLUMN IF NOT EXISTS days_after_sent INTEGER[] DEFAULT ARRAY[1, 3]::INTEGER[];