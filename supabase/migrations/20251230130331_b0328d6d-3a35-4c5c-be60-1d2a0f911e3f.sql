-- Adicionar colunas para imagem de fundo nas campanhas
ALTER TABLE public.redirect_campaigns
ADD COLUMN background_image_url TEXT,
ADD COLUMN background_image_opacity NUMERIC DEFAULT 0.3,
ADD COLUMN background_image_position TEXT DEFAULT 'center';