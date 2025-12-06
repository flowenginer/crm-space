-- Limpar dados corrompidos de referral_data: remover imageUrl/thumbnailUrl que são objetos (bytes)
-- Isso afeta ~561 registros onde Meta enviou bytes ao invés de URL

-- Remover imageUrl que são objetos (bytes corrompidos)
UPDATE conversations
SET referral_data = referral_data - 'imageUrl'
WHERE referral_data IS NOT NULL
  AND jsonb_typeof(referral_data->'imageUrl') = 'object';

-- Remover thumbnailUrl que são objetos (bytes corrompidos)  
UPDATE conversations
SET referral_data = referral_data - 'thumbnailUrl'
WHERE referral_data IS NOT NULL
  AND jsonb_typeof(referral_data->'thumbnailUrl') = 'object';

-- Também limpar referral_data nos contacts
UPDATE contacts
SET referral_data = referral_data - 'imageUrl'
WHERE referral_data IS NOT NULL
  AND jsonb_typeof(referral_data->'imageUrl') = 'object';

UPDATE contacts
SET referral_data = referral_data - 'thumbnailUrl'
WHERE referral_data IS NOT NULL
  AND jsonb_typeof(referral_data->'thumbnailUrl') = 'object';