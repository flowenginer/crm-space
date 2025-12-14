-- Add cancellation tracking fields to quote_expiration_notifications
ALTER TABLE public.quote_expiration_notifications 
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_quote_expiration_notifications_status 
  ON public.quote_expiration_notifications(status);

CREATE INDEX IF NOT EXISTS idx_quote_expiration_notifications_contact_status 
  ON public.quote_expiration_notifications(contact_id, status);

-- Comment on columns
COMMENT ON COLUMN public.quote_expiration_notifications.cancelled_at IS 'When the notification was cancelled';
COMMENT ON COLUMN public.quote_expiration_notifications.cancelled_by IS 'User who cancelled (null for auto-cancel)';
COMMENT ON COLUMN public.quote_expiration_notifications.cancel_reason IS 'Reason: manual, client_responded, quote_converted, quote_status_changed';