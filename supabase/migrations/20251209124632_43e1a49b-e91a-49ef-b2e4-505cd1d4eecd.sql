-- Add signature configuration fields to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS signature_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS signature_enabled boolean DEFAULT true;

-- Set signature_enabled to true for all existing users
UPDATE public.profiles SET signature_enabled = true WHERE signature_enabled IS NULL;