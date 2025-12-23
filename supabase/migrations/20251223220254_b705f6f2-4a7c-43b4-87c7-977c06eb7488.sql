-- Adicionar module_keys faltantes para todos os tenants existentes
INSERT INTO tenant_modules (tenant_id, module_key, is_enabled)
SELECT t.id, m.module_key, true
FROM tenants t
CROSS JOIN (
  VALUES 
    ('dashboard'),
    ('agendamentos'),
    ('quick_messages'),
    ('ao_vivo'),
    ('relatorios'),
    ('seller_dashboard'),
    ('meta_ads')
) AS m(module_key)
WHERE NOT EXISTS (
  SELECT 1 FROM tenant_modules tm 
  WHERE tm.tenant_id = t.id AND tm.module_key = m.module_key
);