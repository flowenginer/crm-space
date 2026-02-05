
# Plano: Corrigir Distribuição Automática de Leads para Todos os Tenants

## Problema Identificado

A Edge Function `distribute-lead` falha silenciosamente ao registrar o histórico de atribuição (`lead_assignment_history`) porque:

1. A função usa `service_role` (sem usuário autenticado)
2. O trigger `set_tenant_id_from_user` exige `tenant_id` explícito ou usuário logado
3. O INSERT em `lead_assignment_history` (linha 380-386) não inclui `tenant_id`

**Impacto atual:**
- `contacts.assigned_to` é atualizado ✅ (Atendente Responsável)
- `conversations.assigned_to` é atualizado ✅ (Atendente Atual - via UPDATE que não aciona trigger de INSERT)
- `lead_assignment_history` falha silenciosamente ⚠️ (histórico não registrado)

## Solução Proposta

Adicionar o `tenant_id` explicitamente no INSERT do `lead_assignment_history`, seguindo o mesmo padrão já usado no `conversation_events` (linha 406).

### Alteração na Edge Function

**Arquivo:** `supabase/functions/distribute-lead/index.ts`

**Antes (linhas 379-386):**
```typescript
const { error: historyError } = await supabase
  .from('lead_assignment_history')
  .insert({
    contact_id: contact_id,
    assigned_to: selectedAgent.id,
    assignment_type: assignmentType,
    assigned_at: new Date().toISOString()
  });
```

**Depois:**
```typescript
const { error: historyError } = await supabase
  .from('lead_assignment_history')
  .insert({
    contact_id: contact_id,
    assigned_to: selectedAgent.id,
    assignment_type: assignmentType,
    assigned_at: new Date().toISOString(),
    tenant_id: tenantId  // Adicionado
  });
```

## Por que isso NÃO afeta outros tenants?

1. **O `tenantId` já existe na função** - É obtido do próprio contato na linha 66
2. **Cada contato já pertence ao seu tenant** - O `tenant_id` vem do contato que está sendo distribuído
3. **Não há lógica condicional por tenant** - A mesma mudança funciona para Space Sports, Master e qualquer outro tenant
4. **O trigger já aceita `tenant_id` explícito** - A função `set_tenant_id_from_user` retorna imediatamente se `tenant_id IS NOT NULL`

## Compatibilidade

| Cenário | Antes | Depois |
|---------|-------|--------|
| Space Sports (seu tenant) | ✅ Funciona | ✅ Funciona |
| Master (usuário cliente) | ⚠️ Falha no histórico | ✅ Funciona |
| Novos tenants futuros | ⚠️ Falhariam | ✅ Funcionarão |

## Detalhes Técnicos

A variável `tenantId` é definida na linha 66 a partir do contato:
```typescript
const tenantId = contact.tenant_id;
```

Portanto, o histórico de atribuição sempre será registrado com o tenant correto do contato que está sendo distribuído, garantindo isolamento completo entre tenants.

## Resumo

- **1 arquivo alterado**: `supabase/functions/distribute-lead/index.ts`
- **1 linha adicionada**: `tenant_id: tenantId` no INSERT de `lead_assignment_history`
- **Risco**: Nenhum - a mudança é aditiva e usa dados já existentes na função
- **Benefício**: Histórico de atribuição funcionará corretamente para TODOS os tenants
