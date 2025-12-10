-- Criar tabela de padrões de mensagens de anúncios
CREATE TABLE public.ad_message_patterns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pattern TEXT NOT NULL,
  match_type TEXT NOT NULL DEFAULT 'exact' CHECK (match_type IN ('exact', 'contains', 'starts_with', 'ends_with')),
  source TEXT NOT NULL DEFAULT 'meta_ads' CHECK (source IN ('meta_ads', 'google_ads', 'linktree', 'site', 'instagram', 'facebook', 'other')),
  campaign_name TEXT,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_ad_message_patterns_active ON public.ad_message_patterns(is_active) WHERE is_active = true;
CREATE INDEX idx_ad_message_patterns_source ON public.ad_message_patterns(source);

-- Enable RLS
ALTER TABLE public.ad_message_patterns ENABLE ROW LEVEL SECURITY;

-- Políticas RLS - apenas admin/supervisor podem gerenciar
CREATE POLICY "Admins can manage ad message patterns"
ON public.ad_message_patterns
FOR ALL
USING (public.is_admin_or_supervisor(auth.uid()));

-- Adicionar coluna origin_detection_method na tabela conversations
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS origin_detection_method TEXT DEFAULT NULL;

-- Comentário para documentação
COMMENT ON COLUMN public.conversations.origin_detection_method IS 'Método usado para identificar origem: referral_api, message_pattern, manual, unknown';

-- Trigger para updated_at
CREATE TRIGGER update_ad_message_patterns_updated_at
BEFORE UPDATE ON public.ad_message_patterns
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir padrões iniciais conhecidos
INSERT INTO public.ad_message_patterns (pattern, match_type, source, campaign_name, description, priority) VALUES
('Olá! Tenho interesse e queria mais informações, por favor.', 'exact', 'meta_ads', NULL, 'Mensagem padrão Click-to-WhatsApp do Meta Ads', 100),
('Olá, vim pelo Linktree e queria mais informações, por favor.', 'exact', 'linktree', NULL, 'Mensagem padrão do Linktree', 90),
('Olá, vim pelo Site e queria mais informações, por favor.', 'exact', 'site', NULL, 'Mensagem padrão do Site', 90);

-- Função para detectar origem por padrão de mensagem
CREATE OR REPLACE FUNCTION public.detect_origin_by_message_pattern(p_message TEXT)
RETURNS TABLE(source TEXT, pattern_id UUID, campaign_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    amp.source,
    amp.id as pattern_id,
    amp.campaign_name
  FROM ad_message_patterns amp
  WHERE amp.is_active = true
    AND (
      (amp.match_type = 'exact' AND p_message = amp.pattern)
      OR (amp.match_type = 'contains' AND p_message ILIKE '%' || amp.pattern || '%')
      OR (amp.match_type = 'starts_with' AND p_message ILIKE amp.pattern || '%')
      OR (amp.match_type = 'ends_with' AND p_message ILIKE '%' || amp.pattern)
    )
  ORDER BY amp.priority DESC, amp.created_at ASC
  LIMIT 1;
END;
$$;