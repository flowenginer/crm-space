-- Tabela principal de campanhas de disparo em massa
CREATE TABLE public.bulk_dispatches (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  template_id uuid NOT NULL REFERENCES rescue_templates(id),
  channel_id uuid NOT NULL REFERENCES whatsapp_channels(id),
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  interval_seconds integer NOT NULL DEFAULT 10,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'paused', 'completed', 'cancelled')),
  total_contacts integer NOT NULL DEFAULT 0,
  processed_count integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  responded_count integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES profiles(id),
  started_at timestamp with time zone,
  paused_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Tabela de contatos por campanha
CREATE TABLE public.bulk_dispatch_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dispatch_id uuid NOT NULL REFERENCES bulk_dispatches(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id),
  conversation_id uuid REFERENCES conversations(id),
  active_rescue_id uuid REFERENCES active_rescues(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'responded', 'error', 'skipped')),
  error_message text,
  sent_at timestamp with time zone,
  responded_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(dispatch_id, contact_id)
);

-- Índices para performance
CREATE INDEX idx_bulk_dispatches_status ON bulk_dispatches(status);
CREATE INDEX idx_bulk_dispatches_created_by ON bulk_dispatches(created_by);
CREATE INDEX idx_bulk_dispatch_contacts_dispatch_id ON bulk_dispatch_contacts(dispatch_id);
CREATE INDEX idx_bulk_dispatch_contacts_status ON bulk_dispatch_contacts(status);
CREATE INDEX idx_bulk_dispatch_contacts_contact_id ON bulk_dispatch_contacts(contact_id);

-- RLS
ALTER TABLE bulk_dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_dispatch_contacts ENABLE ROW LEVEL SECURITY;

-- Políticas para bulk_dispatches
CREATE POLICY "Admins can manage all bulk dispatches"
  ON bulk_dispatches FOR ALL
  USING (is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Users can view their own bulk dispatches"
  ON bulk_dispatches FOR SELECT
  USING (created_by = auth.uid());

CREATE POLICY "Users can create bulk dispatches"
  ON bulk_dispatches FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own bulk dispatches"
  ON bulk_dispatches FOR UPDATE
  USING (created_by = auth.uid() OR is_admin_or_supervisor(auth.uid()));

-- Políticas para bulk_dispatch_contacts
CREATE POLICY "Admins can manage all bulk dispatch contacts"
  ON bulk_dispatch_contacts FOR ALL
  USING (is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Users can view contacts of their dispatches"
  ON bulk_dispatch_contacts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM bulk_dispatches bd
    WHERE bd.id = bulk_dispatch_contacts.dispatch_id
    AND (bd.created_by = auth.uid() OR is_admin_or_supervisor(auth.uid()))
  ));

CREATE POLICY "Users can insert contacts to their dispatches"
  ON bulk_dispatch_contacts FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM bulk_dispatches bd
    WHERE bd.id = bulk_dispatch_contacts.dispatch_id
    AND (bd.created_by = auth.uid() OR is_admin_or_supervisor(auth.uid()))
  ));

CREATE POLICY "Users can update contacts of their dispatches"
  ON bulk_dispatch_contacts FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM bulk_dispatches bd
    WHERE bd.id = bulk_dispatch_contacts.dispatch_id
    AND (bd.created_by = auth.uid() OR is_admin_or_supervisor(auth.uid()))
  ));

-- Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE bulk_dispatches;
ALTER PUBLICATION supabase_realtime ADD TABLE bulk_dispatch_contacts;