-- Add use_client_channel column to tenant_notification_config
ALTER TABLE tenant_notification_config
ADD COLUMN IF NOT EXISTS use_client_channel BOOLEAN DEFAULT true;