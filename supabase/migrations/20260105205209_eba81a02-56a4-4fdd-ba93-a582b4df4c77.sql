-- Atualizar trigger para NÃO sincronizar lead_status e assigned_to
-- Isso mantém o atendente responsável (dono) do contato inalterado
-- e permite que set_lead_status persista corretamente

CREATE OR REPLACE FUNCTION public.sync_conversation_to_contact()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Só sincroniza department_id se mudou
  -- NÃO sincroniza assigned_to (atendente responsável do contato é independente da conversa)
  -- NÃO sincroniza lead_status (status do lead é controlado diretamente no contato)
  IF (OLD.department_id IS DISTINCT FROM NEW.department_id) THEN
    UPDATE contacts
    SET 
      department_id = NEW.department_id,
      updated_at = NOW()
    WHERE id = NEW.contact_id;
  END IF;
  
  RETURN NEW;
END;
$function$;