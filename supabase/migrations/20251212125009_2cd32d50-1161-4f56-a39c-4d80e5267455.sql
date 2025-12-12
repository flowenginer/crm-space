-- Criar tenant padrão se não existir
INSERT INTO public.tenants (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Tenant', 'default')
ON CONFLICT (id) DO NOTHING;

-- Atualizar todos os profiles sem tenant_id para usar o tenant padrão
UPDATE public.profiles 
SET tenant_id = '00000000-0000-0000-0000-000000000001'
WHERE tenant_id IS NULL;

-- Atualizar tabelas financeiras existentes sem tenant_id
UPDATE public.financial_categories 
SET tenant_id = '00000000-0000-0000-0000-000000000001'
WHERE tenant_id IS NULL;

UPDATE public.financial_accounts 
SET tenant_id = '00000000-0000-0000-0000-000000000001'
WHERE tenant_id IS NULL;

UPDATE public.financial_transactions 
SET tenant_id = '00000000-0000-0000-0000-000000000001'
WHERE tenant_id IS NULL;