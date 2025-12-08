-- Step 1: Move messages from duplicate conversation to main conversation
UPDATE messages 
SET conversation_id = '38a0bc09-dc44-4cb6-81b4-4491696b58d2'
WHERE conversation_id = '9171ac8e-709f-4a8e-8887-2191fff1ac1c';

-- Step 2: Move internal notes
UPDATE internal_notes 
SET conversation_id = '38a0bc09-dc44-4cb6-81b4-4491696b58d2'
WHERE conversation_id = '9171ac8e-709f-4a8e-8887-2191fff1ac1c';

-- Step 3: Move conversation tags (ignore duplicates)
INSERT INTO conversation_tags (conversation_id, tag_id, created_at)
SELECT '38a0bc09-dc44-4cb6-81b4-4491696b58d2', tag_id, created_at
FROM conversation_tags
WHERE conversation_id = '9171ac8e-709f-4a8e-8887-2191fff1ac1c'
ON CONFLICT DO NOTHING;

-- Step 4: Delete conversation tags from duplicate
DELETE FROM conversation_tags WHERE conversation_id = '9171ac8e-709f-4a8e-8887-2191fff1ac1c';

-- Step 5: Delete pinned conversations for duplicate
DELETE FROM pinned_conversations WHERE conversation_id = '9171ac8e-709f-4a8e-8887-2191fff1ac1c';

-- Step 6: Update main conversation with latest message info
UPDATE conversations
SET 
  last_message_at = '2025-12-08 13:10:02+00',
  updated_at = NOW()
WHERE id = '38a0bc09-dc44-4cb6-81b4-4491696b58d2';

-- Step 7: Delete duplicate conversation
DELETE FROM conversations WHERE id = '9171ac8e-709f-4a8e-8887-2191fff1ac1c';

-- Step 8: Move contact tags (ignore duplicates)
INSERT INTO contact_tags (contact_id, tag_id, created_at)
SELECT 'bb5c6fa2-b0b6-4e85-b406-b429615633c7', tag_id, created_at
FROM contact_tags
WHERE contact_id = 'ad8d36ae-b0d0-495b-987a-f7e08d51ec9c'
ON CONFLICT DO NOTHING;

-- Step 9: Delete contact tags from duplicate
DELETE FROM contact_tags WHERE contact_id = 'ad8d36ae-b0d0-495b-987a-f7e08d51ec9c';

-- Step 10: Delete duplicate contact ("Você")
DELETE FROM contacts WHERE id = 'ad8d36ae-b0d0-495b-987a-f7e08d51ec9c';