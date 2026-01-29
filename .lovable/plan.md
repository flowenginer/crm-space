
# Plano: Corrigir Políticas RLS para Usuários da Escola Master

## Problema Identificado

Os usuários do tenant **Escola Master** estão impossibilitados de executar ações básicas devido a **108 políticas RLS RESTRICTIVE** que estão faltando a cláusula `WITH CHECK`.

### Causa Raiz

As políticas RLS RESTRICTIVE usam:
```sql
qual: (tenant_id = get_user_tenant_id())
with_check: NULL  -- ❌ PROBLEMA
```

Quando `WITH CHECK` é NULL, o PostgreSQL usa o mesmo `qual` para verificar inserções. Como os INSERTs não enviam `tenant_id` (confiando no trigger para definir), a verificação `NULL = get_user_tenant_id()` sempre falha.

### Exemplo Comparativo

| Tabela | WITH CHECK | Resultado |
|--------|------------|-----------|
| `contacts` | `(tenant_id IS NULL) OR (tenant_id = get_user_tenant_id())` | ✅ Funciona |
| `conversations` | `NULL` | ❌ Falha |
| `internal_chat_messages` | `NULL` | ❌ Falha |
| `tags` | `NULL` | ❌ Falha |

### Ações Afetadas

- Enviar mensagem no chat interno
- Criar tags
- Atribuir contatos a outros
- Criar novos contatos (páginas de contatos)
- Selecionar canal para conversar
- Criar conversas
- Atribuir leads

---

## Solução Proposta

### Correção via SQL

Atualizar todas as 108 políticas RESTRICTIVE para incluir `WITH CHECK`:

```sql
-- Lista das tabelas críticas que precisam correção imediata
ALTER POLICY "Tenant isolation for conversations" 
ON conversations 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for internal_chat_messages" 
ON internal_chat_messages 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for internal_chat_participants" 
ON internal_chat_participants 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for internal_chat_threads" 
ON internal_chat_threads 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for tags" 
ON tags 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

-- ... e outras 103 tabelas
```

### Implementação

1. **Criar script SQL** com todos os `ALTER POLICY` necessários
2. **Executar no Supabase** via SQL Editor
3. **Testar** com usuário da Escola Master

---

## Script Completo

Criarei um arquivo `scripts/fix-rls-with-check.sql` contendo:

```sql
-- =====================================================
-- CORREÇÃO DE POLÍTICAS RLS - WITH CHECK FALTANDO
-- =====================================================
-- Problema: Políticas RESTRICTIVE sem WITH CHECK bloqueiam INSERTs
-- quando tenant_id é NULL antes do trigger executar
-- =====================================================

-- Tabelas críticas (afetam funcionalidade direta)
ALTER POLICY "Tenant isolation for conversations" ON conversations 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for internal_chat_messages" ON internal_chat_messages 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for internal_chat_participants" ON internal_chat_participants 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for internal_chat_threads" ON internal_chat_threads 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for tags" ON tags 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

-- Outras tabelas afetadas (108 no total)
ALTER POLICY "Tenant isolation for account_movements" ON account_movements 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for active_rescues" ON active_rescues 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for activity_log" ON activity_log 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

-- ... (continua para todas as 108 tabelas)
```

---

## Por Que Space Sports Funciona?

A tabela `contacts` já tem a política correta:
```sql
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()))
```

Além disso, dados antigos já têm `tenant_id` definido, então operações de SELECT/UPDATE funcionam. O problema é mais visível em **novos tenants** que tentam inserir dados pela primeira vez.

---

## Resultado Esperado

Após executar o script:
- ✅ Usuários da Escola Master poderão enviar mensagens no chat interno
- ✅ Poderão criar tags
- ✅ Poderão atribuir contatos a outros usuários
- ✅ Poderão criar novos contatos
- ✅ Poderão selecionar canal para conversar
- ✅ Todas as operações de INSERT funcionarão corretamente

---

## Detalhes Técnicos

### Fluxo Atual (Quebrado)

```text
INSERT → RLS CHECK (tenant_id = user_tenant?) → ❌ FALHA (NULL ≠ UUID)
```

### Fluxo Corrigido

```text
INSERT → RLS CHECK (NULL OK ou tenant_id = user_tenant?) → ✅ PASSA
       → TRIGGER define tenant_id automaticamente
       → Dados salvos com tenant_id correto
```

### Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `scripts/fix-rls-with-check.sql` | Script completo com todos os ALTER POLICY |

### Segurança

A cláusula `WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()))` é segura porque:
1. Permite INSERT com `tenant_id = NULL` (trigger define depois)
2. Permite INSERT com `tenant_id` do próprio tenant
3. **Bloqueia** INSERT com `tenant_id` de outro tenant
4. O trigger `set_tenant_id_from_user()` garante que o tenant_id correto seja sempre definido
