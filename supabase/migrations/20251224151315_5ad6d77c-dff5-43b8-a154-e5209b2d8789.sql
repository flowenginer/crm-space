-- Alterar o DEFAULT da coluna is_enabled para false (mais seguro)
ALTER TABLE tenant_modules 
ALTER COLUMN is_enabled SET DEFAULT false;

-- Corrigir o tenant "TESTE ON" - desabilitar os módulos que deveriam estar desabilitados
-- Com base na seleção do usuário: integração, contatos, relatórios, crm_frete foram DESABILITADOS
UPDATE tenant_modules 
SET is_enabled = false 
WHERE tenant_id = 'e4b1fb73-d702-4a82-9bf4-f0ee6e587bf7'
AND module_key IN (
  'integrations',
  'contacts', 
  'reports',
  'reports_conversations',
  'reports_financial',
  'reports_transfers',
  'reports_calls',
  'crm_shipping'
);