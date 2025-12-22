-- Fix unique constraint to allow multiple rescues per conversation across different statuses
-- Keep uniqueness ONLY for active rescues
ALTER TABLE public.active_rescues
DROP CONSTRAINT IF EXISTS active_rescues_conversation_id_status_key;

CREATE UNIQUE INDEX IF NOT EXISTS active_rescues_one_active_per_conversation
ON public.active_rescues (conversation_id)
WHERE status = 'active';
