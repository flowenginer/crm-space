
## Diagnostico: Conversas embaralhando ao clicar

### Problema identificado
Quando o usuario clica em uma conversa na aba "Minhas Conversas", a conversa selecionada "desce" na lista, perdendo a posicao original. O comportamento esperado seria manter a ordem visual estavel.

### Causa raiz
O fluxo problematico e o seguinte:

1. Usuario clica em uma conversa
2. O sistema marca a conversa como lida (UPDATE em `is_unread=false, unread_count=0`)
3. Esse UPDATE dispara o listener de Realtime na tabela `conversations`
4. O listener invalida o cache `conversations-paginated` (debounce 800ms)
5. O refetch busca todas as conversas novamente do servidor, ordenadas por `last_message_at DESC`
6. Se OUTRAS conversas receberam mensagens enquanto o usuario navegava, elas agora aparecem ACIMA da conversa selecionada
7. A conversa selecionada "desce" na lista visual

O sistema de preservacao de scroll (`savedScrollTopRef`) so e ativado ao ENVIAR mensagem, nao ao clicar em uma conversa. Entao quando a lista e reordenada pelo refetch, o scroll nao e restaurado.

### Solucao proposta

**1. Atualizar o cache de forma otimista ao marcar como lida (sem invalidar a lista)**

Em vez de depender do Realtime para reordenar a lista apos marcar como lida, atualizar apenas os campos `is_unread` e `unread_count` diretamente no cache local via `setQueriesData`. Isso evita um refetch completo da lista que causa a reordenacao.

**2. Ignorar eventos Realtime de UPDATE que sao apenas "mark as read"**

No handler de Realtime em `useRealtimeChat.ts`, detectar quando o UPDATE e apenas uma mudanca de `is_unread` (sem mudanca de `assigned_to`, `status`, `last_message_at`) e NAO invalidar a lista paginada nesses casos. A conversa ja esta atualizada localmente pelo passo 1.

**3. Salvar e restaurar posicao do scroll ao selecionar conversa**

Estender o mecanismo existente de `savedScrollTopRef` para tambem salvar a posicao do scroll quando o usuario clica em uma conversa, nao apenas ao enviar mensagem.

### Secao tecnica

**Arquivo: `src/pages/Conversations.tsx`**

No `useEffect` de mark-as-read (linha ~2186), substituir `updateConversation.mutate()` por uma atualizacao otimista do cache + chamada direta ao Supabase:

```text
// Atualizar cache local imediatamente (sem invalidar a lista)
queryClient.setQueriesData(
  { queryKey: ['conversations-paginated'] },
  (oldData) => {
    // Atualizar is_unread e unread_count da conversa no cache
    // SEM reordenar
  }
);

// Enviar update ao servidor silenciosamente (sem trigger de invalidacao)
supabase.from('conversations')
  .update({ is_unread: false, unread_count: 0 })
  .eq('id', conversationId);
```

**Arquivo: `src/hooks/useRealtimeChat.ts`**

No handler de UPDATE da tabela `conversations` (linha ~273), adicionar verificacao:

```text
// Se o UPDATE e APENAS mudanca de is_unread (sem mudanca de status/assigned_to),
// nao invalidar a lista paginada
const onlyUnreadChanged = 
  oldAssignedTo === newAssignedTo && 
  oldStatus === newStatus &&
  (payload.old as any)?.last_message_at === (payload.new as any)?.last_message_at;

if (onlyUnreadChanged) {
  // Atualizar apenas o cache local sem refetch
  return;
}
```

**Arquivo: `src/pages/Conversations.tsx`**

No handler de click/navegacao de conversa, salvar scroll:

```text
// Antes de navegar, salvar posicao do scroll
if (conversationListRef.current) {
  savedScrollTopRef.current = conversationListRef.current.scrollTop;
}
```

### Impacto
- A lista de conversas mantera a ordem estavel ao clicar/navegar entre conversas
- A reordenacao so ocorrera quando houver mudancas reais (nova mensagem, transferencia, etc)
- Nenhuma mudanca no banco de dados necessaria
