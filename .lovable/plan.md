
# Plano: Atualização em Tempo Real do Contador "Aguardando Resposta"

## Problema Identificado

Quando o vendedor envia uma mensagem respondendo ao cliente, o contador "Aguardando resposta: (16)" não diminui imediatamente. O usuário precisa esperar até 30 segundos (refetchInterval) ou receber um evento real-time (que pode ter latência).

## Causa Raiz

O hook `useSendMessage` em `src/hooks/useConversations.ts` invalida apenas as queries:
- `['messages', conversation_id]`
- `['conversations']`
- `['conversations-paginated']`

Mas **NÃO invalida** as queries:
- `['my-waiting-count']`
- `['my-waiting-conversations']`

O real-time subscription existe, mas conforme documentado, não é confiável para ações do próprio usuário devido a latência de rede, carga do servidor, e políticas RLS complexas.

## Solução Proposta

Adicionar invalidação direta das queries de "aguardando resposta" no hook `useSendMessage`, garantindo atualização instantânea quando o próprio vendedor envia uma mensagem.

### Alteração no Arquivo

**Arquivo:** `src/hooks/useConversations.ts`

**Localização:** Bloco `onSettled` do hook `useSendMessage` (linhas 284-290)

**Antes:**
```typescript
onSettled: (_, __, variables) => {
  // Always refetch after error or success to sync with server
  queryClient.invalidateQueries({ queryKey: ['messages', variables.conversation_id] });
  queryClient.invalidateQueries({ queryKey: ['messages-paginated', variables.conversation_id] });
  queryClient.invalidateQueries({ queryKey: ['conversations'] });
  queryClient.invalidateQueries({ queryKey: ['conversations-paginated'] });
},
```

**Depois:**
```typescript
onSettled: (_, __, variables) => {
  // Always refetch after error or success to sync with server
  queryClient.invalidateQueries({ queryKey: ['messages', variables.conversation_id] });
  queryClient.invalidateQueries({ queryKey: ['messages-paginated', variables.conversation_id] });
  queryClient.invalidateQueries({ queryKey: ['conversations'] });
  queryClient.invalidateQueries({ queryKey: ['conversations-paginated'] });
  
  // Invalidar contadores de "aguardando resposta" para atualização instantânea
  // Real-time tem latência, então invalidamos diretamente após ações do próprio usuário
  queryClient.invalidateQueries({ queryKey: ['my-waiting-count'] });
  queryClient.invalidateQueries({ queryKey: ['my-waiting-conversations'] });
},
```

## Por que essa solução funciona?

1. **Ação do próprio usuário**: Quando o vendedor envia uma mensagem, o banco atualiza `last_message_is_from_me = true` na conversa
2. **RPC recalcula**: A função `get_agent_waiting_conversations` exclui conversas onde `last_message_is_from_me = true`
3. **Invalidação direta**: Forçamos o React Query a refazer a consulta imediatamente, sem esperar o real-time
4. **Resultado**: O contador diminui instantaneamente (2-3x mais rápido que esperar o real-time)

## Fluxo Visual

```text
Vendedor envia mensagem
        ↓
sendMessage.mutateAsync() salva no banco
        ↓
Trigger atualiza conversations.last_message_is_from_me = true
        ↓
onSettled invalida ['my-waiting-count']
        ↓
React Query refaz a RPC get_agent_waiting_conversations
        ↓
Conversa respondida não aparece mais (filtrada pelo is_from_me = false)
        ↓
Contador atualiza instantaneamente de (16) para (15)
```

## Impacto

- **1 arquivo alterado**: `src/hooks/useConversations.ts`
- **2 linhas adicionadas** no bloco `onSettled`
- **Benefício**: Contador atualiza instantaneamente após o vendedor responder
- **Risco**: Nenhum - apenas adiciona invalidação de cache (operação idempotente)
- **Performance**: Mínimo impacto - a RPC é leve e já é chamada regularmente

## Bônus: Real-time continua funcionando

O real-time subscription em `useMyWaitingConversations` continua funcionando para:
- Novas mensagens de clientes (aumentar o contador)
- Ações de outros vendedores
- Sincronização entre abas/dispositivos

A invalidação direta é um **complemento**, não uma substituição do real-time.
