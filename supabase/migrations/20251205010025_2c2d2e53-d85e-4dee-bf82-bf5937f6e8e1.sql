-- Add is_typing column to contacts for typing indicator
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS is_typing boolean DEFAULT false;

-- Create index for faster lookup
CREATE INDEX IF NOT EXISTS idx_contacts_is_typing ON public.contacts(is_typing) WHERE is_typing = true;