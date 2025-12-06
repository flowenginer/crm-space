-- Create conversation_events table for tracking transfers and other events
CREATE TABLE public.conversation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  event_type text NOT NULL, -- 'transfer', 'close', 'reopen', etc.
  actor_id uuid REFERENCES public.profiles(id),
  data jsonb DEFAULT '{}'::jsonb, -- Event details (from_user, to_user, to_department, note, etc.)
  created_at timestamp with time zone DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_conversation_events_conversation_id ON public.conversation_events(conversation_id);
CREATE INDEX idx_conversation_events_event_type ON public.conversation_events(event_type);

-- Enable RLS
ALTER TABLE public.conversation_events ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to access conversation events
CREATE POLICY "Authenticated access conversation_events" ON public.conversation_events
FOR ALL USING (auth.uid() IS NOT NULL);