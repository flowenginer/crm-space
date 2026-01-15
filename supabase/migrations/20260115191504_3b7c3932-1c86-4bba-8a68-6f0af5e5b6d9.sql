-- Limpar eventos channel_changed duplicados (onde from_channel_id = to_channel_id)
-- Estes eventos estavam sendo exibidos erroneamente como transferências

DELETE FROM conversation_events
WHERE event_type = 'channel_changed'
  AND (data->>'from_channel_id') = (data->>'to_channel_id');