-- Propagar referral_data para todas as conversas de contatos que vieram de meta_ads
-- Isso garante que qualquer conversa do mesmo contato tenha os dados de origem

-- 1. Primeiro, propagar referral_data de conversas que têm para o contato (se o contato não tiver)
UPDATE contacts c
SET referral_data = conv.referral_data
FROM (
  SELECT DISTINCT ON (contact_id) 
    contact_id, 
    referral_data
  FROM conversations
  WHERE referral_data IS NOT NULL
    AND referral_data != '{}'::jsonb
  ORDER BY contact_id, created_at ASC
) conv
WHERE c.id = conv.contact_id
  AND (c.referral_data IS NULL OR c.referral_data = '{}'::jsonb);

-- 2. Agora, propagar referral_data do contato para todas suas conversas que não têm
UPDATE conversations conv
SET referral_data = c.referral_data
FROM contacts c
WHERE conv.contact_id = c.id
  AND (conv.referral_data IS NULL OR conv.referral_data = '{}'::jsonb)
  AND c.referral_data IS NOT NULL
  AND c.referral_data != '{}'::jsonb;

-- 3. Para contatos com origin = 'meta_ads' que ainda não têm referral_data,
-- buscar de qualquer conversa do mesmo contato
UPDATE contacts c
SET 
  referral_data = subq.referral_data,
  origin = COALESCE(c.origin, 'meta_ads')
FROM (
  SELECT DISTINCT ON (conv.contact_id) 
    conv.contact_id,
    conv.referral_data
  FROM conversations conv
  WHERE conv.referral_data IS NOT NULL 
    AND conv.referral_data != '{}'::jsonb
  ORDER BY conv.contact_id, conv.created_at ASC
) subq
WHERE c.id = subq.contact_id
  AND (c.referral_data IS NULL OR c.referral_data = '{}'::jsonb);