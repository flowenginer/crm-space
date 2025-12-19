-- Add availability_locked_by column to profiles table
-- This column tracks if an admin has locked the agent's availability status
-- When set, the agent cannot toggle their own availability (only request release or wait for new login)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS availability_locked_by uuid REFERENCES public.profiles(id);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_availability_locked_by 
ON public.profiles(availability_locked_by) 
WHERE availability_locked_by IS NOT NULL;

-- Create table for availability release requests
CREATE TABLE IF NOT EXISTS public.availability_release_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  locked_by uuid REFERENCES public.profiles(id),
  reason text,
  status text NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  responded_by uuid REFERENCES public.profiles(id),
  responded_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.availability_release_requests ENABLE ROW LEVEL SECURITY;

-- Agents can create their own requests
CREATE POLICY "Agents can create their own release requests"
ON public.availability_release_requests
FOR INSERT
WITH CHECK (auth.uid() = agent_id);

-- Agents can view their own requests
CREATE POLICY "Agents can view their own release requests"
ON public.availability_release_requests
FOR SELECT
USING (auth.uid() = agent_id);

-- Admins and supervisors can view all requests
CREATE POLICY "Admins can view all release requests"
ON public.availability_release_requests
FOR SELECT
USING (is_admin_or_supervisor(auth.uid()));

-- Admins and supervisors can update requests (approve/reject)
CREATE POLICY "Admins can update release requests"
ON public.availability_release_requests
FOR UPDATE
USING (is_admin_or_supervisor(auth.uid()));

-- Add updated_at trigger
CREATE TRIGGER update_availability_release_requests_updated_at
BEFORE UPDATE ON public.availability_release_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();