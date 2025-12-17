-- Corrigir conversas que têm referral_data mas referral_source IS NULL
UPDATE conversations
SET 
  referral_source = 'meta_ads',
  origin_detection_method = COALESCE(origin_detection_method, 'referral_api_historical_fix'),
  updated_at = NOW()
WHERE referral_data IS NOT NULL
  AND referral_source IS NULL;

-- Corrigir contatos que devem ter origin = 'meta_ads' baseado em suas conversas
UPDATE contacts c
SET 
  origin = 'meta_ads',
  updated_at = NOW()
WHERE EXISTS (
  SELECT 1 FROM conversations cv
  WHERE cv.contact_id = c.id
    AND cv.referral_source = 'meta_ads'
)
AND (c.origin IS NULL OR c.origin != 'meta_ads');