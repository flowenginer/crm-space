-- 1. Corrigir dados históricos: sincronizar contacts.origin com conversations.referral_source
UPDATE contacts c
SET origin = cv.referral_source,
    updated_at = NOW()
FROM conversations cv
WHERE cv.contact_id = c.id
  AND cv.referral_source IS NOT NULL
  AND cv.referral_source != ''
  AND (c.origin IS NULL OR c.origin = '' OR c.origin = 'whatsapp');

-- 2. Criar função de sincronização
CREATE OR REPLACE FUNCTION public.sync_contact_origin_from_conversation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se a conversa tem referral_source, sincronizar com o contato
  IF NEW.referral_source IS NOT NULL AND NEW.referral_source != '' THEN
    UPDATE contacts 
    SET origin = NEW.referral_source,
        updated_at = NOW()
    WHERE id = NEW.contact_id
      AND (origin IS NULL OR origin = '' OR origin = 'whatsapp');
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Criar trigger para sincronização automática em novas conversas
DROP TRIGGER IF EXISTS trigger_sync_contact_origin ON conversations;
CREATE TRIGGER trigger_sync_contact_origin
AFTER INSERT ON conversations
FOR EACH ROW
EXECUTE FUNCTION sync_contact_origin_from_conversation();