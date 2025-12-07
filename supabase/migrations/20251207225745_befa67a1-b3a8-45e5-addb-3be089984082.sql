-- Tabela para armazenar sessões de usuário
CREATE TABLE public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  
  -- Identificação do dispositivo
  device_type TEXT, -- 'desktop', 'mobile', 'tablet'
  browser TEXT,     -- 'Chrome', 'Firefox', 'Safari', etc.
  os TEXT,          -- 'Windows', 'macOS', 'iOS', 'Android', etc.
  
  -- Localização (aproximada via IP)
  ip_address TEXT,
  city TEXT,
  region TEXT,
  country TEXT,
  
  -- Token único da sessão (hash do refresh token)
  session_token TEXT UNIQUE NOT NULL,
  
  -- Status e timestamps
  is_current BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  
  -- User Agent completo para debug
  user_agent TEXT
);

-- Índices para performance
CREATE INDEX idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX idx_user_sessions_session_token ON public.user_sessions(session_token);
CREATE INDEX idx_user_sessions_active ON public.user_sessions(user_id) WHERE ended_at IS NULL;

-- Enable RLS
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Usuários podem ver suas próprias sessões
CREATE POLICY "Users can view own sessions" ON public.user_sessions
  FOR SELECT USING (auth.uid() = user_id);

-- Usuários podem atualizar suas próprias sessões (para encerrar)
CREATE POLICY "Users can update own sessions" ON public.user_sessions
  FOR UPDATE USING (auth.uid() = user_id);

-- Usuários podem deletar suas próprias sessões
CREATE POLICY "Users can delete own sessions" ON public.user_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- Service role pode inserir sessões (via edge function)
CREATE POLICY "Service role can insert sessions" ON public.user_sessions
  FOR INSERT WITH CHECK (true);

-- Admins podem ver todas as sessões (para auditoria)
CREATE POLICY "Admins can view all sessions" ON public.user_sessions
  FOR SELECT USING (is_admin(auth.uid()));