
# Atualizar Status do Lead em Tempo Real (Sem F5)

## Problema

Quando a automacao atualiza o `lead_status` via edge function, o frontend nao reflete a mudanca porque:

1. O realtime listener escuta UPDATEs na tabela `conversations`, mas so invalida a query `conversations-paginated`
2. O painel lateral (sidebar) da conversa usa uma query separada com key `conversation-details` que **nunca e invalidada** pelo realtime
3. Nao existe nenhum listener realtime na tabela `contacts`, entao mudancas no `contacts.lead_status` tambem nao sao captadas
4. O `lead_status` exibido na sidebar vem de `contact.lead_status` (via join), que so atualiza com F5

## Solucao

Adicionar invalidacao da query `conversation-details` no handler de UPDATE do realtime em `useRealtimeChat.ts`. Quando qualquer UPDATE na conversa chegar (incluindo mudanca de `lead_status`), invalidar tambem a query de detalhes.

## Alteracoes

### 1. `src/hooks/useRealtimeChat.ts`

No handler de UPDATE de conversas (dentro do bloco `else` na linha 386-388), adicionar invalidacao de `conversation-details`:

```typescript
// Linha ~386 - bloco else (updates gerais que nao sao close nem transfer)
} else {
  invalidateConversations();
  // Invalidar detalhes da conversa para refletir mudancas de lead_status, etc
  queryClient.invalidateQueries({ 
    queryKey: ['conversation-details', conversationId],
    refetchType: 'active'
  });
}
```

Tambem adicionar no bloco de transferencia (linha ~385) apos `invalidateImmediately()`:

```typescript
queryClient.invalidateQueries({ 
  queryKey: ['conversation-details', conversationId],
  refetchType: 'active'
});
```

### 2. `src/lib/queryInvalidation.ts`

Adicionar `conversation-details` na funcao `invalidateConversationContext`:

```typescript
export function invalidateConversationContext(queryClient, conversationId?) {
  const keysToInvalidate = [
    'conversations',
    'conversation_counts',
    'all_conversation_counts',
    'pinned_conversations',
  ];

  if (conversationId) {
    keysToInvalidate.push(`conversation_${conversationId}`);
    keysToInvalidate.push(`messages_${conversationId}`);
    // Adicionar invalidacao dos detalhes
    queryClient.invalidateQueries({ 
      queryKey: ['conversation-details', conversationId],
      refetchType: 'active'
    });
  }
  // ...resto igual
}
```

## Resultado Esperado

Quando a automacao atualizar o status do lead, o evento UPDATE na tabela `conversations` sera capturado pelo realtime, que agora tambem invalida `conversation-details`. A sidebar vai refazer a query automaticamente e exibir o novo status sem precisar de F5.

## Complexidade

**Muito baixa** - adicionar 2-3 linhas de invalidacao de cache em pontos ja existentes.
