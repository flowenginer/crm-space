-- 1. Adicionar política RLS para leitura pública de campanhas ativas
CREATE POLICY "Public read for active redirect campaigns"
ON redirect_campaigns
FOR SELECT
TO public
USING (is_active = true);

-- 2. Adicionar contador de visualizações na campanha
ALTER TABLE redirect_campaigns ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0;

-- 3. Criar tabela para rastrear visualizações únicas
CREATE TABLE IF NOT EXISTS redirect_campaign_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES redirect_campaigns(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  tenant_id UUID REFERENCES tenants(id),
  UNIQUE(campaign_id, visitor_id)
);

-- 4. Habilitar RLS na tabela de views
ALTER TABLE redirect_campaign_views ENABLE ROW LEVEL SECURITY;

-- 5. Política para inserção pública de views
CREATE POLICY "Public insert views"
ON redirect_campaign_views
FOR INSERT
TO public
WITH CHECK (true);

-- 6. Política para leitura por tenant
CREATE POLICY "Tenant can read own views"
ON redirect_campaign_views
FOR SELECT
USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- 7. Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_campaign_views_campaign_id ON redirect_campaign_views(campaign_id);

-- 8. Função para incrementar views_count
CREATE OR REPLACE FUNCTION increment_campaign_views()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE redirect_campaigns 
  SET views_count = views_count + 1 
  WHERE id = NEW.campaign_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Trigger para incrementar automaticamente
DROP TRIGGER IF EXISTS trigger_increment_campaign_views ON redirect_campaign_views;
CREATE TRIGGER trigger_increment_campaign_views
AFTER INSERT ON redirect_campaign_views
FOR EACH ROW
EXECUTE FUNCTION increment_campaign_views();