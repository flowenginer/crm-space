-- Habilitar os novos módulos para aparecerem no menu (tenant_modules)
DO $$
DECLARE
  t_id UUID;
BEGIN
  FOR t_id IN SELECT id FROM tenants LOOP
    INSERT INTO tenant_modules (tenant_id, module_key, is_enabled)
    VALUES 
      (t_id, 'marketing_group', true),
      (t_id, 'marketing_dashboard', true)
    ON CONFLICT (tenant_id, module_key) DO UPDATE
      SET is_enabled = EXCLUDED.is_enabled;
  END LOOP;
END $$;