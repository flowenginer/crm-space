
# Correção: RLS de Canais WhatsApp para Multi-Tenant

## Problema Identificado
Usuários de tenants não-master (como Yuri) não conseguem criar canais WhatsApp porque a coluna `tenant_id` tem um valor DEFAULT apontando para o tenant master, causando conflito com a política RLS.

## Causa Raiz
Mesma situação que foi corrigida na tabela `contacts`:
- `tenant_id` tem DEFAULT `'00000000-0000-0000-0000-000000000001'`
- Política RLS verifica `tenant_id = get_user_tenant_id()`
- O DEFAULT preenche com master ANTES da RLS validar → bloqueio

## Solução

### Migração SQL (única alteração necessária)

```sql
-- 1. Remover o DEFAULT do tenant_id
ALTER TABLE whatsapp_channels 
ALTER COLUMN tenant_id DROP DEFAULT;

-- 2. Atualizar política RLS para permitir NULL no WITH CHECK
DROP POLICY IF EXISTS "Tenant isolation for whatsapp_channels" ON whatsapp_channels;

CREATE POLICY "Tenant isolation for whatsapp_channels" ON whatsapp_channels
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id())
WITH CHECK (tenant_id IS NULL OR tenant_id = get_user_tenant_id());
```

## Fluxo Após Correção
1. **INSERT** → `tenant_id` fica `NULL`
2. **RLS WITH CHECK** → permite (porque `tenant_id IS NULL`)
3. **Trigger** `set_tenant_id_from_user` → preenche com o tenant correto do usuário
4. **Dados persistidos** → com o `tenant_id` correto

## Impacto
- Zero impacto em dados existentes
- Todos os tenants poderão criar canais WhatsApp
- Isolamento de dados mantido (cada tenant vê apenas seus canais)

## Arquivos Afetados
Nenhum arquivo de código precisa ser alterado - apenas migração SQL.
