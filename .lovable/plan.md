
# Plano de Correção: Erros Multi-Tenant em Múltiplas Tabelas

## Diagnóstico

### Problema Principal
Identificamos o **mesmo padrão** que já corrigimos em `contacts` e `whatsapp_channels` afetando outras tabelas:

1. **Tabelas com DEFAULT para master tenant** - 50+ tabelas ainda têm `DEFAULT '00000000-0000-0000-0000-000000000001'` na coluna `tenant_id`
2. **Políticas RLS sem WITH CHECK adequado** - As políticas restritivas bloqueiam INSERT antes do trigger poder corrigir o tenant_id

### Tabelas Afetadas (reportadas pelo usuário)
| Tabela | Erro | Causa |
|--------|------|-------|
| `departments` | ✅ DEFAULT + RLS sem WITH CHECK | Criar departamento falha |
| `profiles` | ✅ DEFAULT + RLS sem WITH CHECK | Adicionar perfil falha |
| `workflow_automations` | A verificar | Criar automação falha |

### Erro TypeScript Adicional
Os tipos em `src/integrations/supabase/types.ts` mostram `tenant_id: string` como obrigatório no Insert para `whatsapp_channels`, quando deveria ser opcional após a remoção do DEFAULT.

---

## Solução

### Fase 1: Correção de Banco de Dados (Migração SQL)

Aplicar o mesmo padrão já validado em `contacts` e `whatsapp_channels`:

```sql
-- 1. Remover DEFAULTs das tabelas críticas
ALTER TABLE departments ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE profiles ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE workflow_automations ALTER COLUMN tenant_id DROP DEFAULT;

-- 2. Atualizar políticas RLS para permitir NULL no WITH CHECK

-- departments
DROP POLICY IF EXISTS "Tenant isolation for departments" ON departments;
CREATE POLICY "Tenant isolation for departments" ON departments
AS RESTRICTIVE FOR ALL TO authenticated
USING (tenant_id = get_user_tenant_id())
WITH CHECK (tenant_id IS NULL OR tenant_id = get_user_tenant_id());

-- profiles  
DROP POLICY IF EXISTS "Tenant isolation for profiles" ON profiles;
CREATE POLICY "Tenant isolation for profiles" ON profiles
AS RESTRICTIVE FOR ALL TO authenticated
USING (tenant_id = get_user_tenant_id())
WITH CHECK (tenant_id IS NULL OR tenant_id = get_user_tenant_id());

-- workflow_automations (se existir política)
DROP POLICY IF EXISTS "Tenant isolation for workflow_automations" ON workflow_automations;
CREATE POLICY "Tenant isolation for workflow_automations" ON workflow_automations
AS RESTRICTIVE FOR ALL TO authenticated
USING (tenant_id = get_user_tenant_id())
WITH CHECK (tenant_id IS NULL OR tenant_id = get_user_tenant_id());
```

### Fase 2: Correção TypeScript

Atualizar o tipo Insert de `whatsapp_channels` para tornar `tenant_id` opcional:

```typescript
// src/integrations/supabase/types.ts linha ~10412
// De: tenant_id: string
// Para: tenant_id?: string | null
```

---

## Fluxo Após Correção

```text
┌─────────────────────────────────────────────────────────────┐
│  1. INSERT executado (tenant_id = NULL)                     │
│                          ↓                                  │
│  2. RLS WITH CHECK permite (tenant_id IS NULL)              │
│                          ↓                                  │
│  3. Trigger set_tenant_id_from_user() executa               │
│                          ↓                                  │
│  4. tenant_id preenchido com get_user_tenant_id()           │
│                          ↓                                  │
│  5. Dados salvos com tenant_id correto do usuário           │
└─────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| Nova migração SQL | Remover DEFAULTs + Atualizar políticas RLS |
| `src/integrations/supabase/types.ts` | Tornar tenant_id opcional no Insert de whatsapp_channels |

---

## Resultado Esperado

- Usuários de qualquer tenant poderão criar departamentos, perfis e automações
- Isolamento de dados mantido (cada tenant vê apenas seus próprios dados)
- Erros TypeScript corrigidos
- Mesmo padrão aplicado consistentemente em todas as tabelas multi-tenant
