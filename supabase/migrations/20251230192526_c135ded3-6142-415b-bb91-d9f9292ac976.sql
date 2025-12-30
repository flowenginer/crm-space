-- Remover políticas antigas problemáticas
DROP POLICY IF EXISTS "Public insert views" ON redirect_campaign_views;

-- Criar política de INSERT para usuários anônimos
CREATE POLICY "Allow anonymous view insert"
  ON redirect_campaign_views FOR INSERT
  TO anon
  WITH CHECK (tenant_id IS NOT NULL);

-- Criar política de UPDATE para permitir UPSERT anônimo
CREATE POLICY "Allow anonymous view update"
  ON redirect_campaign_views FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (tenant_id IS NOT NULL);

-- Criar política de SELECT anônimo (necessário para UPSERT verificar conflitos)
CREATE POLICY "Allow anonymous view select for upsert"
  ON redirect_campaign_views FOR SELECT
  TO anon
  USING (true);