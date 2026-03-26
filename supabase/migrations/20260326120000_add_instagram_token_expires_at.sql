-- Adicionar campo token_expires_at na tabela instagram_configs
-- para controlar a expiração e renovação automática dos tokens
ALTER TABLE public.instagram_configs
  ADD COLUMN IF NOT EXISTS token_expires_at timestamptz;

-- Atualizar configs existentes para expirar em 30 dias (estimativa conservadora)
-- já que não sabemos quando os tokens atuais foram gerados
UPDATE public.instagram_configs
SET token_expires_at = now() + interval '30 days'
WHERE token_expires_at IS NULL AND is_active = true;
