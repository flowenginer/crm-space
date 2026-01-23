-- Função para marcar novos áudios como pendentes de transcrição
CREATE OR REPLACE FUNCTION set_audio_transcription_pending()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.message_type = 'audio' 
     AND NEW.media_url IS NOT NULL 
     AND NEW.tenant_id = '00000000-0000-0000-0000-000000000001' THEN
    NEW.transcription_status := 'pending';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para executar antes de inserir mensagens
DROP TRIGGER IF EXISTS trigger_audio_transcription_pending ON messages;

CREATE TRIGGER trigger_audio_transcription_pending
  BEFORE INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION set_audio_transcription_pending();