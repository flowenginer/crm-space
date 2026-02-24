ALTER TABLE public.whatsapp_channels 
ADD COLUMN IF NOT EXISTS webhook_events_configured_at timestamptz DEFAULT NULL;