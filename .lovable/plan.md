
# Plano: Corrigir RLS de message_templates para INSERT

## Problema

A politica `Tenant isolation for message_templates` esta configurada como **RESTRICTIVE** mas falta a clausula `WITH CHECK`, o que bloqueia todas as operacoes de INSERT e UPDATE.

### Situacao Atual

| Politica | Tipo | QUAL (SELECT) | WITH CHECK (INSERT/UPDATE) |
|----------|------|---------------|---------------------------|
| Authenticated access | PERMISSIVE | `auth.uid() IS NOT NULL` | (nenhum) |
| Tenant isolation | RESTRICTIVE | `tenant_id = get_user_tenant_id()` | (nenhum) - **CAUSA DO ERRO** |

Quando uma politica RESTRICTIVE nao tem `WITH CHECK`, o PostgreSQL bloqueia automaticamente todas as escritas.

---

## Solucao

Recriar a politica de tenant isolation com `WITH CHECK` para permitir INSERT/UPDATE de templates dentro do tenant do usuario.

### SQL da Migracao

```sql
-- Remover politica atual (sem WITH CHECK)
DROP POLICY IF EXISTS "Tenant isolation for message_templates" ON public.message_templates;

-- Recriar com WITH CHECK para permitir INSERT/UPDATE
CREATE POLICY "Tenant isolation for message_templates"
ON public.message_templates
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id())
WITH CHECK (tenant_id = get_user_tenant_id());
```

---

## Resultado Esperado

Apos a correcao:
- SELECT: Usuarios podem ver apenas templates do seu tenant
- INSERT: Usuarios podem criar templates (trigger `set_tenant_id_from_user` preenchera o tenant_id automaticamente)
- UPDATE: Usuarios podem editar templates do seu tenant
- DELETE: Usuarios podem deletar templates do seu tenant

---

## Arquivos Modificados

| Arquivo | Acao |
|---------|------|
| Nova migracao SQL | Criar politica com WITH CHECK |

Nenhum arquivo de codigo precisa ser alterado - o hook `useCreateTemplate` ja esta correto.

---

## Validacao

Apos aprovar a migracao:
1. Usuario "master" acessa Mensagens Rapidas
2. Grava um audio ou digita uma mensagem
3. Clica em Salvar
4. Template deve ser criado com sucesso
