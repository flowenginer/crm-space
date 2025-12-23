-- Migração para sincronizar chaves de módulos com o formato atual
-- Adiciona módulos essenciais que estavam faltando para o tenant SPACE TECH

-- Primeiro, identificar o tenant Space Tech
DO $$
DECLARE
  v_space_tech_id UUID;
BEGIN
  SELECT id INTO v_space_tech_id FROM tenants WHERE slug = 'space' OR name ILIKE '%space%tech%' LIMIT 1;
  
  IF v_space_tech_id IS NOT NULL THEN
    -- Adicionar módulos faltantes (upsert para evitar duplicatas)
    INSERT INTO tenant_modules (tenant_id, module_key, is_enabled)
    VALUES 
      (v_space_tech_id, 'dashboard', true),
      (v_space_tech_id, 'conversations', true),
      (v_space_tech_id, 'contacts', true),
      (v_space_tech_id, 'crm', true),
      (v_space_tech_id, 'orders', true),
      (v_space_tech_id, 'quotes', true),
      (v_space_tech_id, 'financial', true),
      (v_space_tech_id, 'reports', true),
      (v_space_tech_id, 'settings', true),
      (v_space_tech_id, 'live_monitor', true),
      (v_space_tech_id, 'quick_messages', true),
      (v_space_tech_id, 'rescue_templates', true),
      (v_space_tech_id, 'bulk_dispatch', true),
      (v_space_tech_id, 'scheduled_messages', true),
      (v_space_tech_id, 'automations', true),
      (v_space_tech_id, 'whatsapp_channels', true),
      (v_space_tech_id, 'internal_chat', true),
      (v_space_tech_id, 'internal_email', true),
      (v_space_tech_id, 'gamification', true),
      (v_space_tech_id, 'products', true),
      (v_space_tech_id, 'webhooks', true),
      (v_space_tech_id, 'meta_ads', true),
      (v_space_tech_id, 'campaign_report', true)
    ON CONFLICT (tenant_id, module_key) DO UPDATE SET is_enabled = true;
    
    RAISE NOTICE 'Módulos atualizados para tenant Space Tech: %', v_space_tech_id;
  END IF;
END $$;

-- Também normalizar chaves existentes que possam estar com hífens (para todos os tenants)
UPDATE tenant_modules
SET module_key = REPLACE(module_key, '-', '_')
WHERE module_key LIKE '%-%';