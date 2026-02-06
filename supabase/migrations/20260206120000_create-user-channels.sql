-- =====================================================
-- TABELA user_channels: Vincular usuários a canais específicos
-- =====================================================
-- Permite controle granular de quais canais cada usuário pode ver
-- Se um usuário não tiver nenhum canal configurado, ele verá:
-- - Canais do seu departamento (comportamento antigo)
-- - OU todos os canais se for admin/supervisor

CREATE TABLE IF NOT EXISTS public.user_channels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES public.whatsapp_channels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  tenant_id UUID NOT NULL,
  UNIQUE(user_id, channel_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_user_channels_user_id ON public.user_channels(user_id);
CREATE INDEX IF NOT EXISTS idx_user_channels_channel_id ON public.user_channels(channel_id);
CREATE INDEX IF NOT EXISTS idx_user_channels_tenant_id ON public.user_channels(tenant_id);

-- RLS Policies
ALTER TABLE public.user_channels ENABLE ROW LEVEL SECURITY;

-- Policy para SELECT: usuários podem ver seus próprios vínculos
CREATE POLICY "user_channels_select_policy" ON public.user_channels
  FOR SELECT
  USING (
    tenant_id = public.get_user_tenant_id()
  );

-- Policy para INSERT: admins podem criar vínculos
CREATE POLICY "user_channels_insert_policy" ON public.user_channels
  FOR INSERT
  WITH CHECK (
    tenant_id = public.get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'supervisor')
    )
  );

-- Policy para DELETE: admins podem remover vínculos
CREATE POLICY "user_channels_delete_policy" ON public.user_channels
  FOR DELETE
  USING (
    tenant_id = public.get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'supervisor')
    )
  );

-- Trigger para auto-preencher tenant_id
CREATE OR REPLACE FUNCTION public.set_user_channels_tenant_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := public.get_user_tenant_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_user_channels_tenant_id
  BEFORE INSERT ON public.user_channels
  FOR EACH ROW
  EXECUTE FUNCTION public.set_user_channels_tenant_id();

-- Comentários
COMMENT ON TABLE public.user_channels IS 'Relacionamento direto entre usuários e canais WhatsApp que podem acessar';
COMMENT ON COLUMN public.user_channels.user_id IS 'ID do usuário (profile)';
COMMENT ON COLUMN public.user_channels.channel_id IS 'ID do canal WhatsApp';
