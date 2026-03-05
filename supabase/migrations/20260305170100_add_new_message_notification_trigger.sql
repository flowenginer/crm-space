-- Trigger to notify assigned agent when a new incoming message arrives
CREATE OR REPLACE FUNCTION public.notify_on_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_conversation RECORD;
  v_contact_name TEXT;
  v_message_preview TEXT;
BEGIN
  -- Only for incoming messages (from contacts, not from agents)
  IF NEW.direction != 'incoming' THEN
    RETURN NEW;
  END IF;

  -- Get conversation details
  SELECT c.id, c.assigned_to, c.tenant_id, c.contact_id
  INTO v_conversation
  FROM public.conversations c
  WHERE c.id = NEW.conversation_id;

  -- Only notify if conversation has an assigned agent
  IF v_conversation.assigned_to IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get contact name
  SELECT full_name INTO v_contact_name
  FROM public.contacts
  WHERE id = v_conversation.contact_id;

  -- Build message preview (truncate to 100 chars)
  v_message_preview := LEFT(COALESCE(NEW.content, '[Midia]'), 100);

  -- Avoid duplicate notifications for same conversation within 5 minutes
  IF EXISTS (
    SELECT 1 FROM public.in_app_notifications
    WHERE user_id = v_conversation.assigned_to
      AND type = 'new_message'
      AND conversation_id = v_conversation.id
      AND created_at > NOW() - INTERVAL '5 minutes'
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.in_app_notifications (tenant_id, user_id, type, title, message, conversation_id, contact_name)
  VALUES (
    v_conversation.tenant_id,
    v_conversation.assigned_to,
    'new_message',
    'Nova mensagem de ' || COALESCE(v_contact_name, 'Contato'),
    v_message_preview,
    v_conversation.id,
    COALESCE(v_contact_name, 'Contato')
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_new_message
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_new_message();
