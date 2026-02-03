
## Diagnóstico (causa raiz confirmada)

O problema **não é só do bloco “Alterar Status Lead”**: as automações da Master estão falhando antes mesmo de executar os nós, porque **a criação da execução do fluxo (flow_executions) está dando erro**.

Nos logs do Edge Function `process-flow-triggers` apareceu este erro ao tentar criar execução:

- `tenant_id é obrigatório e não foi possível determinar automaticamente` (code `P0001`)

Isso acontece porque:

1) As tabelas `flow_executions` e `flow_execution_logs` estão com:
- `tenant_id` **NOT NULL**
- `DEFAULT get_user_tenant_id()`
- trigger `set_tenant_id_from_user()` **BEFORE INSERT**

2) Edge Functions (`process-flow-triggers`, `execute-flow-node`, `process-flow-delays`) rodam com **Service Role**, então **não existe `auth.uid()`**.  
Resultado: `get_user_tenant_id()` não consegue determinar tenant, e o trigger **lança exceção** quando `tenant_id` não é enviado explicitamente.

3) Hoje o `process-flow-triggers` faz `.insert({...})` em `flow_executions` **sem enviar `tenant_id`**, então **nenhuma automação chega a executar o nó de status**.

## Objetivo

- Garantir que **toda inserção feita por Edge Functions** em:
  - `flow_executions`
  - `flow_execution_logs`
  
  seja feita com `tenant_id` explícito, para não depender de `get_user_tenant_id()` / `auth.uid()`.

Assim as automações da Master voltam a rodar e, consequentemente, os blocos de atualização de status voltam a funcionar.

---

## O que vou implementar (correções completas para Master e para qualquer tenant)

### 1) Corrigir `process-flow-triggers` para criar execuções com `tenant_id`
Arquivo: `supabase/functions/process-flow-triggers/index.ts`

Mudanças:
- No `.insert()` de `flow_executions`, incluir `tenant_id: tenant_id` (o tenant já vem no body e já é usado para filtrar os fluxos).
- Melhorar observabilidade: ao invocar `execute-flow-node`, capturar `{ error }` do `supabase.functions.invoke(...)` e logar se houver falha (hoje não checa `error`, então pode falhar silenciosamente).

Impacto esperado:
- As execuções passam a ser criadas normalmente para a Master.
- O fluxo passa a avançar para os nós (incluindo `set_lead_status`).

### 2) Corrigir `execute-flow-node` para inserir logs com `tenant_id`
Arquivo: `supabase/functions/execute-flow-node/index.ts`

Mudanças:
- Atualizar `logExecution(...)` para aceitar `tenant_id` e incluir esse campo no insert em `flow_execution_logs`.
- Passar `execution.tenant_id` nas chamadas de log (o execution já é buscado no início da função).

Impacto esperado:
- Logs deixam de falhar por `tenant_id NOT NULL`.
- Diagnóstico futuro fica muito mais fácil (sem “silêncio” nos logs).

### 3) Corrigir `process-flow-delays` (delays/timeouts) para inserir logs com `tenant_id`
Arquivo: `supabase/functions/process-flow-delays/index.ts`

Mudanças:
- Alterar os selects de `flow_executions` para também trazer `tenant_id` (ex.: `select('id, current_node_id, tenant_id')`).
- Incluir `tenant_id` nos objetos `delayLogs` e `timeoutLogs` antes do batch insert em `flow_execution_logs`.

Impacto esperado:
- Processamento de delays/timeouts volta a funcionar sem quebrar por erro de insert.
- Fluxos com espera (delay / wait_reply) voltam a concluir corretamente.

---

## Sequência de entrega

1) Implementar mudanças nos 3 Edge Functions acima.
2) Deploy das Edge Functions atualizadas.
3) Validação rápida e objetiva com a Master:
   - Enviar uma mensagem que deveria disparar uma automação `message_key`
   - Confirmar nos logs:
     - `process-flow-triggers` não tem mais erro de tenant
     - execução criada com sucesso
     - `execute-flow-node` é invocado
   - Confirmar no banco:
     - `flow_executions` criada com `tenant_id = 664dfcb4-...`
     - `contacts.lead_status` atualizado
4) Se necessário, validar também 1 fluxo de cada tipo (message_key e keyword) para garantir cobertura.

---

## Critérios de sucesso (o que você vai ver)

- As automações da Master voltam a disparar normalmente.
- O bloco **“Alterar Status Lead”** efetivamente atualiza o `lead_status` do contato.
- Os logs de execução voltam a aparecer (não ficam falhando por tenant_id).

---

## Observações importantes

- A migração que colocou `DEFAULT get_user_tenant_id()` faz sentido para inserts vindos do frontend autenticado, mas **Edge Functions (Service Role) precisam sempre setar `tenant_id` explicitamente** para tabelas multi-tenant com `NOT NULL`.
- Esta correção não é “só para Master”: elimina a causa raiz para qualquer tenant e previne recorrência.

## Checklist técnico (para auditoria rápida)

- [ ] `process-flow-triggers`: insert `flow_executions` inclui `tenant_id`
- [ ] `execute-flow-node`: insert `flow_execution_logs` inclui `tenant_id`
- [ ] `process-flow-delays`: batch insert `flow_execution_logs` inclui `tenant_id`
- [ ] Deploy realizado
- [ ] Teste end-to-end em 1 conversa da Master com trigger `message_key`
