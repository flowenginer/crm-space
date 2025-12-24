-- Corrigir TESTE ON: desabilitar integração, contatos, relatórios, crm_frete
UPDATE tenant_modules 
SET is_enabled = false, updated_at = now()
WHERE tenant_id = 'e4b1fb73-d702-4a82-9bf4-f0ee6e587bf7'
AND module_key IN (
  'integrations_group',
  'settings_integrations',
  'contacts',
  'reports',
  'reports_group',
  'reports_attendance',
  'reports_conversations',
  'reports_financial',
  'reports_transfers',
  'reports_calls',
  'relatorios_atendimentos',
  'crm_frete'
);