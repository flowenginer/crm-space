-- Corrigir função com search_path para segurança
CREATE OR REPLACE FUNCTION increment_campaign_views()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.redirect_campaigns 
  SET views_count = views_count + 1 
  WHERE id = NEW.campaign_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;