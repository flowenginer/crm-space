
## Correção da Automacao EMPREGA-MAIS - Atribuição de Leads

### Problema
Leads respondem o chatbot mas nao sao atribuidos a nenhum vendedor. A automacao trava no no de delay (30 segundos) e nunca executa os passos seguintes: envio de audio, mudanca de status e transferencia de departamento.

### Causa Raiz
A Edge Function `process-flow-delays` deployada esta em versao antiga que tenta acessar `flow_nodes.connections` -- uma coluna que nao existe mais. O codigo no repositorio ja esta correto (usa a tabela `flow_connections`), mas nunca foi re-deployado.

### Fluxo do erro:
```text
Lead entra --> Audio boas-vindas --> Perguntas --> Delay 30s
                                                      |
                                              process-flow-delays tenta
                                              buscar flow_nodes.connections
                                                      |
                                                  ERRO 42703
                                                      |
                                              Execucao fica em "error"
                                                      |
                                          Nunca executa: audio final,
                                          mudanca status, transferencia
                                                      |
                                          Lead fica SEM atendente
```

### Plano de Correção

**Passo 1 - Deploy da Edge Function atualizada**
Re-deployar `process-flow-delays` com a versao do repositorio que usa `flow_connections` ao inves de `flow_nodes.connections`.

**Passo 2 - Reprocessar execuções travadas**
Executar SQL para resetar as execucoes que ficaram com `status = 'error'` e `error_message = 'Delay node not found'` ou `'Timeout node not found'` neste fluxo, colocando-as de volta em `waiting_delay` / `waiting_reply` com `waiting_until` no passado para que sejam imediatamente reprocessadas no proximo ciclo.

Execucoes afetadas (hoje):
- Sophia Tonelli, Eduarda, Tavinho, Gesilene Silva, Beatriz, millena, Diana, M2 eletrica, jeny, Davi Costa, e outras

**Passo 3 - Validacao**
Acompanhar os logs de `process-flow-delays` apos o deploy para confirmar que as execucoes sao retomadas e os leads sao transferidos para o departamento `fd51d4fb-4688-4a03-a2ed-1a7fb485d40b`.

### Secao Tecnica

- Tabela com coluna inexistente: `flow_nodes.connections` (removida em migracao anterior)
- Tabela correta: `flow_connections` (source_node_id, target_node_id, source_handle)
- Edge Function: `supabase/functions/process-flow-delays/index.ts` -- codigo ja correto no repositorio
- Erro Postgres: `42703` (undefined_column)
- SQL de reset:
```text
UPDATE flow_executions
SET status = 'waiting_delay',
    error_message = NULL,
    waiting_until = NOW() - interval '1 minute'
WHERE flow_id = '381a4177-6a52-4531-9f2c-f09cb5fc586f'
  AND status = 'error'
  AND error_message IN ('Delay node not found', 'Timeout node not found')
```
