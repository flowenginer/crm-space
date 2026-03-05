-- Create in-app notifications table
CREATE TABLE IF NOT EXISTS public.in_app_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('new_message', 'assignment', 'transfer', 'sla', 'channel_disconnect', 'mention', 'rescue_reply')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  contact_name TEXT,
  metadata JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes for performance
CREATE INDEX idx_in_app_notifications_user_unread ON public.in_app_notifications (user_id, read, created_at DESC) WHERE read = false;
CREATE INDEX idx_in_app_notifications_tenant ON public.in_app_notifications (tenant_id, created_at DESC);
CREATE INDEX idx_in_app_notifications_user_created ON public.in_app_notifications (user_id, created_at DESC);

-- RLS
ALTER TABLE public.in_app_notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "Users can view own notifications"
  ON public.in_app_notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update (mark as read) their own notifications
CREATE POLICY "Users can update own notifications"
  ON public.in_app_notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role can insert (from webhooks/triggers)
CREATE POLICY "Service role can insert notifications"
  ON public.in_app_notifications FOR INSERT
  WITH CHECK (true);

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
  ON public.in_app_notifications FOR DELETE
  USING (auth.uid() = user_id);

-- Auto-cleanup old notifications (older than 30 days)
-- This can be run as a cron job
CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.in_app_notifications
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$;

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.in_app_notifications;

-- Function to create notification when conversation is assigned
CREATE OR REPLACE FUNCTION public.notify_on_conversation_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_contact_name TEXT;
  v_tenant_id UUID;
BEGIN
  -- Only fire when assigned_to changes and is not null
  IF (TG_OP = 'UPDATE' AND NEW.assigned_to IS NOT NULL AND
      (OLD.assigned_to IS NULL OR OLD.assigned_to != NEW.assigned_to)) THEN

    -- Get contact name
    SELECT full_name INTO v_contact_name
    FROM public.contacts
    WHERE id = NEW.contact_id;

    -- Get tenant_id
    v_tenant_id := NEW.tenant_id;

    -- Check if this is a transfer (old had assignment)
    IF OLD.assigned_to IS NOT NULL AND OLD.assigned_to != NEW.assigned_to THEN
      INSERT INTO public.in_app_notifications (tenant_id, user_id, type, title, message, conversation_id, contact_name)
      VALUES (
        v_tenant_id,
        NEW.assigned_to,
        'transfer',
        'Conversa transferida',
        COALESCE(NEW.transfer_note, 'Uma conversa foi transferida para voce'),
        NEW.id,
        COALESCE(v_contact_name, 'Contato')
      );
    ELSE
      -- New assignment
      INSERT INTO public.in_app_notifications (tenant_id, user_id, type, title, message, conversation_id, contact_name)
      VALUES (
        v_tenant_id,
        NEW.assigned_to,
        'assignment',
        'Nova conversa atribuida',
        'A conversa com ' || COALESCE(v_contact_name, 'um contato') || ' foi atribuida a voce',
        NEW.id,
        COALESCE(v_contact_name, 'Contato')
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_conversation_assignment
  AFTER UPDATE ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_conversation_assignment();

-- Function to create notification when SLA becomes critical
CREATE OR REPLACE FUNCTION public.notify_on_sla_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_contact_name TEXT;
BEGIN
  IF (TG_OP = 'UPDATE' AND NEW.assigned_to IS NOT NULL AND
      NEW.sla_status IN ('warning', 'critical') AND
      (OLD.sla_status IS NULL OR OLD.sla_status NOT IN ('warning', 'critical'))) THEN

    SELECT full_name INTO v_contact_name
    FROM public.contacts
    WHERE id = NEW.contact_id;

    INSERT INTO public.in_app_notifications (tenant_id, user_id, type, title, message, conversation_id, contact_name)
    VALUES (
      NEW.tenant_id,
      NEW.assigned_to,
      'sla',
      CASE WHEN NEW.sla_status = 'critical' THEN 'SLA Critico!' ELSE 'Alerta de SLA' END,
      CASE WHEN NEW.sla_status = 'critical'
        THEN 'A conversa com ' || COALESCE(v_contact_name, 'um contato') || ' atingiu SLA critico!'
        ELSE 'A conversa com ' || COALESCE(v_contact_name, 'um contato') || ' esta proximo do SLA'
      END,
      NEW.id,
      COALESCE(v_contact_name, 'Contato')
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_sla_change
  AFTER UPDATE ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_sla_change();
