
# Plano de Correção: Envio de Mensagens Falhando para Outros Tenants

## Problema Identificado

O Yuri não consegue enviar mensagens porque a tabela `messages` tem o **mesmo problema de RLS** que corrigimos em outras tabelas:

- **Erro nos logs**: `new row violates row-level security policy "Tenant isolation for messages" for table "messages"`
- **Causa raiz**: `tenant_id` com DEFAULT do master tenant + política RLS sem `WITH CHECK` adequado

## Solução

### Migração SQL

```sql
-- 1. Remover DEFAULT do master tenant
ALTER TABLE messages ALTER COLUMN tenant_id DROP DEFAULT;

-- 2. Atualizar política RLS para permitir NULL no INSERT
DROP POLICY IF EXISTS "Tenant isolation for messages" ON messages;
CREATE POLICY "Tenant isolation for messages" ON messages
AS RESTRICTIVE FOR ALL TO authenticated
USING (tenant_id = get_user_tenant_id())
WITH CHECK (tenant_id IS NULL OR tenant_id = get_user_tenant_id());
```

## Resultado Esperado

Após a correção:
- Yuri e outros usuários de qualquer tenant poderão enviar mensagens
- O trigger `set_tenant_id_from_user` preencherá o `tenant_id` correto automaticamente
- Isolamento de dados mantido entre tenants

## Arquivos

| Arquivo | Alteração |
|---------|-----------|
| Nova migração SQL | Corrigir RLS da tabela `messages` |

---

**Nota**: Também detectei erros repetidos de `column whatsapp_channels.phone_number does not exist` nos logs, mas este é um problema separado que pode ser investigado depois.
