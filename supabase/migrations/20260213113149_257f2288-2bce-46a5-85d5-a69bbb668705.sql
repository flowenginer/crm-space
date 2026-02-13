UPDATE contacts SET origin = 'linktree'
WHERE id IN (
  SELECT DISTINCT c.id
  FROM contacts c
  JOIN conversations conv ON conv.contact_id = c.id
  JOIN messages m ON m.conversation_id = conv.id
  WHERE LOWER(m.content) LIKE '%linktree%'
    AND m.is_from_me = false
    AND (c.origin IS NULL OR c.origin NOT IN ('linktree'))
);