-- Delete empty conversations from VENDAS 03 channel
DELETE FROM conversations
WHERE channel_id = '8be00605-9a83-435d-b3e4-7a5614efc4d1'
AND (last_message_at IS NULL OR last_message_preview IS NULL OR last_message_preview = '');