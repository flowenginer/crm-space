
# Corrigir tenant_id no Payload de Update do set_lead_status

## Problema

A correção anterior adicionou `tenant_id` apenas no **filtro** (`.eq('tenant_id', ...)`), mas o trigger do banco de dados precisa que o `tenant_id` esteja presente no **payload do UPDATE** (no objeto passado ao `.update()`). Sem isso, o PostgreSQL trigger que registra o histórico de status (`lead_status_history`) tenta acessar `NEW.tenant_id` e falha com o erro P0001.

Os logs confirmam:
```
ERROR: "tenant_id é obrigatório e não foi possível determinar automaticamente"
```

A tag é adicionada com sucesso porque usa outra lógica, mas o status falha por causa desse trigger.

## Solução

Incluir `tenant_id: execution.tenant_id` no objeto `.update()` em **3 locais** dentro do case `set_lead_status`:

1. **Linha 730** - Update na tabela `contacts`
2. **Linha 745** - Update na conversa atual (`conversations`)
3. **Linha ~759** - Update em outras conversas abertas do contato

Também atualizar a constante `VERSION` para confirmar que o novo deploy está ativo.

## Alterações

### `supabase/functions/execute-flow-node/index.ts`

**Linha 4** - Atualizar versão:
```
const VERSION = '2026-02-06.1800';
```

**Linha 730** - Adicionar tenant_id no update de contacts:
```javascript
// De:
.update({ lead_status: newStatus })
// Para:
.update({ lead_status: newStatus, tenant_id: execution.tenant_id })
```

**Linha 745** - Adicionar tenant_id no update da conversa atual:
```javascript
// De:
.update({ lead_status: newStatus })
// Para:
.update({ lead_status: newStatus, tenant_id: execution.tenant_id })
```

**Linha ~759** - Adicionar tenant_id no update de outras conversas:
```javascript
// De:
.update({ lead_status: newStatus })
// Para:
.update({ lead_status: newStatus, tenant_id: execution.tenant_id })
```

### Deploy

Fazer deploy da edge function `execute-flow-node` após as alterações.

## Complexidade

**Muito baixa** - adicionar 1 campo em 3 updates e atualizar a versão. Após o deploy, testar a automação novamente para confirmar que os logs mostram a nova versão e que o status atualiza corretamente.
