-- Update conversations that reference deleted channels to use the active channel
UPDATE conversations 
SET channel_id = '60aead0c-e7e3-49ca-8976-d19651ca9708' 
WHERE channel_id = '3b3e86ad-b002-42ea-a338-dc59af4a3bc3';