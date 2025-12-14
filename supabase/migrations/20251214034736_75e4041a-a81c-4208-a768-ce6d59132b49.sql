-- Add paused fields to quote_expiration_notifications
ALTER TABLE public.quote_expiration_notifications 
  ADD COLUMN IF NOT EXISTS paused BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paused_by UUID REFERENCES public.profiles(id);

-- Add index for paused notifications
CREATE INDEX IF NOT EXISTS idx_quote_expiration_notifications_paused 
ON public.quote_expiration_notifications(paused) 
WHERE paused = true;