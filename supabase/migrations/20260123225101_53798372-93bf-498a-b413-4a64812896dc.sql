-- Atualizar trigger de INSERT para incluir filtro de 45 dias
CREATE OR REPLACE FUNCTION public.mark_audio_transcription_pending()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  conv_lead_status TEXT;
BEGIN
  -- Verificar tenant, tipo de mensagem, URL E idade (máximo 45 dias)
  IF NEW.tenant_id = '00000000-0000-0000-0000-000000000001' 
     AND NEW.message_type = 'audio' 
     AND NEW.media_url IS NOT NULL 
     AND NEW.transcription_status IS NULL
     AND NEW.created_at >= NOW() - INTERVAL '45 days' THEN
    
    -- Buscar lead_status da conversa
    SELECT lead_status INTO conv_lead_status
    FROM conversations
    WHERE id = NEW.conversation_id;
    
    -- Só marcar como pending se lead_status for elegível (07-13)
    IF conv_lead_status IN (
      '07 - Pedido Fechado',
      '08 - Em andamento',
      '09 - Cobrança',
      '10 - Aguardando envio',
      '11 - Pedido Enviado',
      '12 - Entregue',
      '13 - Recompra'
    ) THEN
      NEW.transcription_status := 'pending';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Atualizar trigger de mudança de status para incluir filtro de 45 dias
CREATE OR REPLACE FUNCTION public.mark_audios_pending_on_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Verificar se o novo status é elegível (07-13) e o antigo não era
  IF NEW.lead_status IN (
    '07 - Pedido Fechado',
    '08 - Em andamento', 
    '09 - Cobrança',
    '10 - Aguardando envio',
    '11 - Pedido Enviado',
    '12 - Entregue',
    '13 - Recompra'
  ) AND (OLD.lead_status IS NULL OR OLD.lead_status NOT IN (
    '07 - Pedido Fechado',
    '08 - Em andamento',
    '09 - Cobrança', 
    '10 - Aguardando envio',
    '11 - Pedido Enviado',
    '12 - Entregue',
    '13 - Recompra'
  )) THEN
    -- Marcar áudios como pending APENAS se criados nos últimos 45 dias
    UPDATE messages
    SET transcription_status = 'pending'
    WHERE conversation_id = NEW.id
      AND message_type = 'audio'
      AND media_url IS NOT NULL
      AND (transcription_status IS NULL OR transcription_status = '')
      AND created_at >= NOW() - INTERVAL '45 days';
  END IF;
  RETURN NEW;
END;
$function$;