
# Correção: "Atendente Atual" não preenchido na distribuição de leads

## Problema Identificado

Nos logs da Edge Function `distribute-lead`, encontrei o erro exato:

```text
Error updating conversation 178d0cd3-...: {
  code: "P0001",
  message: "tenant_id é obrigatório e não foi possível determinar automaticamente"
}
```

O que acontece:
1. O contato (`contacts.assigned_to` = atendente responsável) e atualizado com sucesso
2. A conversa (`conversations.assigned_to` = atendente atual) FALHA porque o UPDATE não inclui o `tenant_id`, e um trigger no banco de dados exige esse campo

## Solução

Adicionar o campo `tenant_id` no UPDATE da conversa (linha 378), já que o `tenantId` já está disponível na função (extraído do contato na linha 66).

## Alteração

**Arquivo:** `supabase/functions/distribute-lead/index.ts`

Na seção de update das conversas (linhas 375-385), adicionar `tenant_id: tenantId` ao objeto de update:

| Campo | Antes | Depois |
|-------|-------|--------|
| Update da conversa | `assigned_to`, `department_id`, `status`, `updated_at` | `assigned_to`, `department_id`, `status`, `updated_at`, **`tenant_id: tenantId`** |

```text
// ANTES (linha 377-382):
.update({
  assigned_to: selectedAgent.id,
  department_id: departmentId,
  status: conversationStatus,
  updated_at: new Date().toISOString()
})

// DEPOIS:
.update({
  assigned_to: selectedAgent.id,
  department_id: departmentId,
  status: conversationStatus,
  updated_at: new Date().toISOString(),
  tenant_id: tenantId
})
```

Isso garante que o trigger de validação do banco receba o `tenant_id` e permita o UPDATE, preenchendo corretamente o campo "atendente atual" na conversa.

## Resultado Esperado

Após a correção, quando o n8n chamar `distribute-lead`:
- Atendente responsável (contacts.assigned_to) = preenchido (já funciona)
- Atendente atual (conversations.assigned_to) = preenchido (será corrigido)
- Ambos com o mesmo agente, conforme a regra de sincronização do sistema
