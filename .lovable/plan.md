
# Plano: Permitir Vendedores da Master Visualizarem Todos os Contatos

## Diagnóstico

Após análise detalhada, identifiquei o problema:

### Situação Atual

| Componente | Status |
|------------|--------|
| RPC `search_contacts_paginated` | Retorna todos os contatos do tenant (SECURITY DEFINER) |
| RPC `search_contacts_unaccent` | Retorna todos os contatos do tenant (SECURITY DEFINER) |
| RLS SELECT na tabela `contacts` | Bloqueia contatos atribuídos a outros vendedores |
| Vendedores Master | `can_view_all_conversations = false` |
| Departamentos Master | `can_view_all_conversations = false` |

### O que está causando o problema

A RPC de busca retorna os contatos corretamente, mas as queries secundárias que buscam dados relacionados (assignee, department) passam pelo RLS e falham em trazer dados para contatos de outros vendedores.

Além disso, várias partes do sistema fazem queries diretas na tabela `contacts` sem usar as RPCs, sendo bloqueadas pelo RLS.

---

## Solução Recomendada

Existem duas abordagens possíveis:

### Opção A: Habilitar flag no Departamento (RECOMENDADO)

Ativar `can_view_all_conversations = true` para os departamentos da Master. Isso permite que todos os vendedores desses departamentos vejam todos os contatos automaticamente.

**Vantagens:**
- Não requer mudanças no código
- Aplicado instantaneamente
- Controle granular por departamento

**Desvantagem:**
- Afeta também visualização de conversas

### Opção B: Alterar política RLS para permitir visualização global

Modificar a política RLS de SELECT em `contacts` para permitir visualização tenant-wide para vendedores, mantendo a restrição apenas para UPDATES.

**Arquivo afetado:** Nova migration SQL

---

## Implementação Recomendada (Opção A + B combinadas)

### Correção 1: Habilitar visualização global nos departamentos Master

Executar migration SQL para:
```sql
UPDATE departments
SET can_view_all_conversations = true
WHERE tenant_id = '664dfcb4-5432-4c14-9838-7db14360cabf';
```

### Correção 2: Adicionar política RLS para leitura tenant-wide de contatos

Criar nova política para permitir que todos os usuários autenticados do mesmo tenant **visualizem** contatos (mas não editem os de outros):

```sql
-- Política de leitura tenant-wide para contatos
CREATE POLICY "Users can view all tenant contacts"
  ON contacts FOR SELECT
  USING (tenant_id = get_user_tenant_id());
```

Esta política será avaliada em conjunto com as outras políticas SELECT existentes (OR lógico), garantindo que qualquer usuário autenticado do tenant possa ver todos os contatos.

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/migrations/xxx.sql` | Habilitar `can_view_all_conversations` nos departamentos Master E/OU criar política RLS de leitura tenant-wide |

---

## Considerações de Segurança

A mudança proposta mantém a segurança porque:

1. **Isolamento de tenant** permanece intacto via `get_user_tenant_id()`
2. Vendedores podem **ver** contatos de outros, mas **não editar** (políticas UPDATE continuam restritivas)
3. Transferências e edições continuam exigindo propriedade ou permissão admin
4. A funcionalidade de "pedir contato de volta" continua relevante para operações de UPDATE

---

## Complexidade

- **Nível:** Baixa
- **Risco:** Baixo (apenas amplia visualização, não altera permissões de escrita)
- **Tempo estimado:** Imediato (apenas migration SQL)
