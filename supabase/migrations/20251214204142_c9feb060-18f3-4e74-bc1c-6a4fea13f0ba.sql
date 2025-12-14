-- Tabela principal de e-mails internos
CREATE TABLE internal_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  
  -- Remetente
  sender_id UUID NOT NULL REFERENCES profiles(id),
  
  -- Conteúdo
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  body_html TEXT,
  
  -- Prioridade e Status
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  status TEXT DEFAULT 'sent' CHECK (status IN ('draft', 'sent', 'scheduled')),
  
  -- Categoria para Produção
  category TEXT DEFAULT 'general',
  
  -- Vinculação com Módulos
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  
  -- Thread (para respostas)
  parent_email_id UUID REFERENCES internal_emails(id) ON DELETE SET NULL,
  thread_id UUID,
  
  -- Agendamento
  scheduled_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de destinatários
CREATE TABLE internal_email_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID NOT NULL REFERENCES internal_emails(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  
  -- Tipo de destinatário
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('to', 'cc')),
  
  -- Status para cada destinatário
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  is_starred BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMP WITH TIME ZONE,
  
  -- Labels/Marcadores
  labels TEXT[] DEFAULT '{}',
  
  -- Pasta atual
  folder TEXT DEFAULT 'inbox' CHECK (folder IN ('inbox', 'starred', 'archive', 'trash')),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(email_id, user_id)
);

-- Tabela de anexos
CREATE TABLE internal_email_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID NOT NULL REFERENCES internal_emails(id) ON DELETE CASCADE,
  
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  
  -- Para layouts especificamente
  is_layout_file BOOLEAN DEFAULT false,
  layout_version INTEGER DEFAULT 1,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de labels customizáveis
CREATE TABLE internal_email_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6B7280',
  icon TEXT DEFAULT 'Tag',
  
  is_system BOOLEAN DEFAULT false,
  
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_internal_emails_sender ON internal_emails(sender_id);
CREATE INDEX idx_internal_emails_thread ON internal_emails(thread_id);
CREATE INDEX idx_internal_emails_status ON internal_emails(status);
CREATE INDEX idx_internal_emails_category ON internal_emails(category);
CREATE INDEX idx_internal_emails_order ON internal_emails(order_id);
CREATE INDEX idx_internal_emails_quote ON internal_emails(quote_id);
CREATE INDEX idx_internal_emails_sent_at ON internal_emails(sent_at DESC);

CREATE INDEX idx_email_recipients_user ON internal_email_recipients(user_id);
CREATE INDEX idx_email_recipients_email ON internal_email_recipients(email_id);
CREATE INDEX idx_email_recipients_folder ON internal_email_recipients(user_id, folder);
CREATE INDEX idx_email_recipients_unread ON internal_email_recipients(user_id, is_read) WHERE is_read = false;

-- RLS Policies
ALTER TABLE internal_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_email_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_email_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_email_labels ENABLE ROW LEVEL SECURITY;

-- internal_emails policies
CREATE POLICY "Sender can view own emails" ON internal_emails
  FOR SELECT USING (sender_id = auth.uid());

CREATE POLICY "Sender can insert emails" ON internal_emails
  FOR INSERT WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Sender can update own drafts" ON internal_emails
  FOR UPDATE USING (sender_id = auth.uid() AND status = 'draft');

CREATE POLICY "Sender can delete own drafts" ON internal_emails
  FOR DELETE USING (sender_id = auth.uid() AND status = 'draft');

CREATE POLICY "Recipients can view emails" ON internal_emails
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM internal_email_recipients 
      WHERE email_id = internal_emails.id 
      AND user_id = auth.uid()
    )
  );

-- internal_email_recipients policies
CREATE POLICY "Users can view own recipient entries" ON internal_email_recipients
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Sender can insert recipients" ON internal_email_recipients
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM internal_emails 
      WHERE id = internal_email_recipients.email_id 
      AND sender_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own recipient entries" ON internal_email_recipients
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Sender can view recipients of own emails" ON internal_email_recipients
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM internal_emails 
      WHERE id = internal_email_recipients.email_id 
      AND sender_id = auth.uid()
    )
  );

-- internal_email_attachments policies
CREATE POLICY "Sender can manage attachments" ON internal_email_attachments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM internal_emails 
      WHERE id = internal_email_attachments.email_id 
      AND sender_id = auth.uid()
    )
  );

CREATE POLICY "Recipients can view attachments" ON internal_email_attachments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM internal_email_recipients 
      WHERE email_id = internal_email_attachments.email_id 
      AND user_id = auth.uid()
    )
  );

-- internal_email_labels policies
CREATE POLICY "Authenticated users can view labels" ON internal_email_labels
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create labels" ON internal_email_labels
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

CREATE POLICY "Users can update own labels" ON internal_email_labels
  FOR UPDATE USING (created_by = auth.uid() AND is_system = false);

CREATE POLICY "Users can delete own labels" ON internal_email_labels
  FOR DELETE USING (created_by = auth.uid() AND is_system = false);

-- Inserir labels padrão do sistema
INSERT INTO internal_email_labels (name, color, icon, is_system) VALUES
  ('Solicitação de Layout', '#F59E0B', 'Palette', true),
  ('Entrega de Layout', '#10B981', 'FileCheck', true),
  ('Layout Aprovado', '#22C55E', 'CheckCircle', true),
  ('Layout Rejeitado', '#EF4444', 'XCircle', true),
  ('Urgente', '#DC2626', 'AlertTriangle', true),
  ('Produção', '#8B5CF6', 'Factory', true);

-- Função para obter contagem de não lidos
CREATE OR REPLACE FUNCTION get_internal_email_unread_count(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM internal_email_recipients
    WHERE user_id = p_user_id
      AND is_read = false
      AND is_deleted = false
      AND folder = 'inbox'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para atualizar thread_id automaticamente
CREATE OR REPLACE FUNCTION set_email_thread_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_email_id IS NOT NULL THEN
    -- Se é uma resposta, herda o thread_id do pai
    SELECT COALESCE(thread_id, id) INTO NEW.thread_id
    FROM internal_emails
    WHERE id = NEW.parent_email_id;
  ELSE
    -- Se é um novo e-mail, thread_id é o próprio id
    NEW.thread_id := NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_set_email_thread_id
  BEFORE INSERT ON internal_emails
  FOR EACH ROW
  EXECUTE FUNCTION set_email_thread_id();

-- Trigger para definir sent_at quando status muda para 'sent'
CREATE OR REPLACE FUNCTION set_email_sent_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'sent' AND OLD.status != 'sent' THEN
    NEW.sent_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_set_email_sent_at
  BEFORE UPDATE ON internal_emails
  FOR EACH ROW
  EXECUTE FUNCTION set_email_sent_at();

-- Storage bucket para anexos
INSERT INTO storage.buckets (id, name, public)
VALUES ('internal-email-attachments', 'internal-email-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Authenticated users can upload email attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'internal-email-attachments' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Authenticated users can view email attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'internal-email-attachments' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can delete own email attachments"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'internal-email-attachments' 
  AND auth.uid() IS NOT NULL
);