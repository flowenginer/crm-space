
# Correção: Atendente Atual não preenchido na automação "Transferir Departamento"

## Problema

Os logs de 15:13 confirmam que o erro **ainda persiste**:

```
Error updating conversation cb7d464f-...: {
  code: "P0001",
  message: "tenant_id é obrigatório e não foi possível determinar automaticamente"
}
```

Existem **dois pontos** que precisam de correção:

### 1. `execute-flow-node/index.ts` (linhas 784-790)

Quando a ação `transfer_department` executa, ela faz um UPDATE na conversa para limpar o `assigned_to` e definir o `department_id`, mas **sem incluir `tenant_id`**. Isso faz o trigger do banco rejeitar a operação.

**Antes:**
```
.update({
  department_id: targetDepartmentId,
  assigned_to: null
})
```

**Depois:**
```
.update({
  department_id: targetDepartmentId,
  assigned_to: null,
  tenant_id: execution.tenant_id
})
```

### 2. `distribute-lead/index.ts` - Redesploying

A correção anterior (adicionar `tenant_id: tenantId` no update da conversa) ja esta no codigo, mas precisa ser redeployada para garantir que esta ativa em producao.

## Arquivos a alterar

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/execute-flow-node/index.ts` | Adicionar `tenant_id: execution.tenant_id` no UPDATE da conversa (linha 786) |
| `supabase/functions/distribute-lead/index.ts` | Redeploy (codigo ja esta correto) |

## Resultado Esperado

Apos a correção, o fluxo da automacao sera:
1. `execute-flow-node` limpa o `assigned_to` e define o departamento (com `tenant_id`) -- funciona
2. `distribute-lead` seleciona agente e atualiza a conversa (com `tenant_id`) -- funciona
3. Tanto o "Atendente Atual" quanto o "Atendente Responsavel" serao preenchidos corretamente
