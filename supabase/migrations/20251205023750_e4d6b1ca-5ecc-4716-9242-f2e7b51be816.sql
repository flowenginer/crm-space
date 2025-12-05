-- Create table for pinned conversations (per user)
CREATE TABLE public.pinned_conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  pinned_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(user_id, conversation_id)
);

-- Enable RLS
ALTER TABLE public.pinned_conversations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only manage their own pins
CREATE POLICY "Users can manage own pins" ON public.pinned_conversations
FOR ALL USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Index for faster lookups
CREATE INDEX idx_pinned_conversations_user ON public.pinned_conversations(user_id);
CREATE INDEX idx_pinned_conversations_conversation ON public.pinned_conversations(conversation_id);

-- Enable realtime for this table
ALTER TABLE public.pinned_conversations REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pinned_conversations;