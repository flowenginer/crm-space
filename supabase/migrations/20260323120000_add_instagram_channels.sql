-- =====================================================
-- INSTAGRAM CHANNELS TABLE
-- Tabela para armazenar canais de Instagram conectados
-- =====================================================

CREATE TABLE IF NOT EXISTS public.instagram_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Identificação do canal
  name TEXT NOT NULL,
  instagram_account_id TEXT NOT NULL,
  instagram_username TEXT,

  -- Credenciais Meta
  page_id TEXT NOT NULL,
  page_access_token TEXT NOT NULL,
  app_secret TEXT,
  verify_token TEXT NOT NULL,

  -- Perfil
  profile_picture_url TEXT,
  followers_count INTEGER DEFAULT 0,

  -- Status
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('disconnected', 'connecting', 'connected')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  webhook_configured BOOLEAN NOT NULL DEFAULT false,

  -- Departamento
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,

  -- Estatísticas
  messages_sent INTEGER DEFAULT 0,
  messages_received INTEGER DEFAULT 0,
  messages_sent_today INTEGER DEFAULT 0,
  messages_received_today INTEGER DEFAULT 0,
  last_sync_at TIMESTAMPTZ,

  -- Soft delete
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_instagram_channels_tenant_id ON public.instagram_channels(tenant_id);
CREATE INDEX IF NOT EXISTS idx_instagram_channels_instagram_account_id ON public.instagram_channels(instagram_account_id);
CREATE INDEX IF NOT EXISTS idx_instagram_channels_status ON public.instagram_channels(status);
CREATE INDEX IF NOT EXISTS idx_instagram_channels_is_deleted ON public.instagram_channels(is_deleted);

-- RLS
ALTER TABLE public.instagram_channels ENABLE ROW LEVEL SECURITY;

-- Policy: Usuários podem ver canais do seu tenant
CREATE POLICY "Users can view their tenant instagram channels"
  ON public.instagram_channels FOR SELECT
  USING (
    tenant_id IN (
      SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

-- Policy: Admins podem inserir canais
CREATE POLICY "Admins can insert instagram channels"
  ON public.instagram_channels FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

-- Policy: Admins podem atualizar canais
CREATE POLICY "Admins can update instagram channels"
  ON public.instagram_channels FOR UPDATE
  USING (
    tenant_id IN (
      SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

-- Policy: Admins podem deletar canais
CREATE POLICY "Admins can delete instagram channels"
  ON public.instagram_channels FOR DELETE
  USING (
    tenant_id IN (
      SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

-- =====================================================
-- ADICIONAR CAMPOS DE INSTAGRAM NAS TABELAS EXISTENTES
-- =====================================================

-- Adicionar campo instagram_id na tabela contacts (para armazenar IGSID)
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS instagram_id TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS instagram_username TEXT;

-- Index para busca por instagram_id
CREATE INDEX IF NOT EXISTS idx_contacts_instagram_id ON public.contacts(instagram_id) WHERE instagram_id IS NOT NULL;

-- Adicionar campos de Instagram na tabela conversations
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS instagram_channel_id UUID REFERENCES public.instagram_channels(id) ON DELETE SET NULL;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS channel_type TEXT DEFAULT 'whatsapp' CHECK (channel_type IN ('whatsapp', 'instagram'));

-- Index para busca por instagram_channel_id
CREATE INDEX IF NOT EXISTS idx_conversations_instagram_channel_id ON public.conversations(instagram_channel_id) WHERE instagram_channel_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_channel_type ON public.conversations(channel_type);

-- Adicionar campo instagram_message_id na tabela messages
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS instagram_message_id TEXT;

-- Index para busca por instagram_message_id
CREATE INDEX IF NOT EXISTS idx_messages_instagram_message_id ON public.messages(instagram_message_id) WHERE instagram_message_id IS NOT NULL;

-- =====================================================
-- INSTAGRAM WEBHOOK LOGS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.instagram_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  channel_id UUID REFERENCES public.instagram_channels(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL DEFAULT 'unknown',
  sender_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed BOOLEAN NOT NULL DEFAULT false,
  processing_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_instagram_webhook_logs_channel_id ON public.instagram_webhook_logs(channel_id);
CREATE INDEX IF NOT EXISTS idx_instagram_webhook_logs_created_at ON public.instagram_webhook_logs(created_at);

ALTER TABLE public.instagram_webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant instagram webhook logs"
  ON public.instagram_webhook_logs FOR SELECT
  USING (
    tenant_id IN (
      SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

CREATE POLICY "System can insert instagram webhook logs"
  ON public.instagram_webhook_logs FOR INSERT
  WITH CHECK (true);

-- =====================================================
-- MENU ITEM PARA INSTAGRAM CHANNELS
-- =====================================================

-- Adicionar item de menu para Canais Instagram
INSERT INTO public.menu_items (title, href, icon, parent_id, position, permission, is_active)
VALUES (
  'Canais Instagram',
  '/instagram-channels',
  'Instagram',
  NULL,
  16,
  'channels.view',
  true
)
ON CONFLICT DO NOTHING;

-- =====================================================
-- ENABLE REALTIME FOR INSTAGRAM CHANNELS
-- =====================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.instagram_channels;
