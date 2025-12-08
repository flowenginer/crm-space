-- Add conversation_events table to realtime publication
-- This ensures all clients receive updates when transfers, closes, etc happen
ALTER PUBLICATION supabase_realtime ADD TABLE conversation_events;