-- Adicionar coluna email na tabela profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS email text;

-- Criar índice para buscas por email
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Adicionar comentário explicativo
COMMENT ON COLUMN public.profiles.email IS 'Email do usuário (duplicado de auth.users para facilitar consultas)';