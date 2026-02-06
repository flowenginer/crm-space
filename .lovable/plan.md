
# Corrigir Bloco "Alterar Status Lead" na Automacao

## Problema Identificado

Os logs mostram claramente o erro:

```
ERROR [execute-flow-node] Erro ao atualizar contacts.lead_status: {
  code: "P0001",
  message: "tenant_id é obrigatório e não foi possível determinar automaticamente"
}
```

O bloco `set_lead_status` **executa corretamente** (os logs confirmam a transicao "Atendimento -> Agendado"), porem a query de UPDATE na tabela `contacts` falha porque nao inclui `tenant_id` no payload. A tabela `contacts` possui um trigger que exige esse campo.

A etiqueta e adicionada com sucesso porque usa outra logica, mas o status nao atualiza por causa desse erro.

## Solucao

Adicionar `tenant_id: execution.tenant_id` no payload de UPDATE da tabela `contacts` dentro do case `set_lead_status`.

## Alteracao

### `supabase/functions/execute-flow-node/index.ts`

**Linha 728** - Incluir `tenant_id` no update de contacts:

De:
```javascript
.update({ lead_status: newStatus })
```

Para:
```javascript
.update({ lead_status: newStatus, tenant_id: execution.tenant_id })
```

Essa mesma correcao ja foi aplicada em outros blocos (como `transfer_department` na linha 797 que ja inclui `tenant_id`), faltou apenas no `set_lead_status`.

## Complexidade

**Muito baixa** - adicionar 1 campo em 1 linha de codigo. Apos a correcao, sera necessario fazer deploy da edge function.
