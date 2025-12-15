-- Correção: Copiar referral_data para a conversa ativa
UPDATE conversations 
SET 
  referral_data = (SELECT referral_data FROM conversations WHERE id = '3fad4f78-4fc5-4a74-a88b-74a30a5e0c6f'),
  referral_source = 'meta_ads',
  origin_detection_method = 'propagated_from_related'
WHERE id = '8b44c746-f90b-4ee6-9ee3-015c717d6e97'
  AND referral_data IS NULL;