

# Correção: Requisições de Contato não Transferem Acesso

## Problema Identificado

Ao aprovar a requisição do Eduardo, **nada acontece**. Dois bugs combinados:

1. O `conversation_id` chega como `null` na requisição (o modal permite enviar sem conversa vinculada)
2. O tipo "Atendente Atual" (attendant) só atualiza a conversa, mas sem `conversation_id`, a aprovação é um no-op total

Dados reais confirmam: as 2 requisições aprovadas do Eduardo para "Jesse Miguel" têm `conversation_id: null`, e o contato continua atribuído ao dono original.

## Solução

### 1. Buscar conversa automaticamente na aprovação

**Arquivo:** `src/hooks/useContactRequests.ts`

Na funcao `useApproveContactRequest`, depois de buscar a requisicao, se `conversation_id` for null, buscar a conversa ativa (status = open) do contato automaticamente:

```text
// Pseudocode:
Se request.conversation_id == null:
  Buscar conversa com contact_id = request.contact_id E status = 'open'
  Se encontrar, usar esse conversation_id
```

### 2. Para tipo "attendant" sem conversa, criar shared_conversations

Se tipo = attendant e existe conversa, alem de reatribuir o `assigned_to` da conversa, criar um registro em `shared_conversations` para que Eduardo tenha visibilidade. Isso garante acesso mesmo sem ser o "dono" do contato.

### 3. Para tipo "owner", garantir que o contato E a conversa sejam transferidos

Mesmo quando `conversation_id` chega null, a conversa ativa sera encontrada e transferida junto com o contato.

### 4. Ajustar o modal de criacao (preventivo)

**Arquivo:** `src/components/conversations/ContactRequestModal.tsx`

Quando o modal for aberto a partir de um contexto sem conversa, buscar a conversa ativa do contato e inclui-la automaticamente na requisicao.

## Detalhes Tecnicos

### Alteracao principal em `useContactRequests.ts` - funcao `useApproveContactRequest`:

```typescript
// Apos buscar a requisicao (linha 230-234), adicionar:
let conversationId = request.conversation_id;

// Se nao tem conversation_id, buscar conversa ativa do contato
if (!conversationId) {
  const { data: activeConversation } = await supabase
    .from('conversations')
    .select('id')
    .eq('contact_id', request.contact_id)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activeConversation) {
    conversationId = activeConversation.id;
  }
}
```

Depois, usar `conversationId` (a variavel local) em vez de `request.conversation_id` em todas as operacoes de transferencia.

### Para tipo "attendant", alem de atribuir conversa, criar shared_conversation:

```typescript
if (request.request_type === 'attendant' && conversationId) {
  // Atribuir conversa ao requester
  await supabase.from('conversations').update({
    assigned_to: request.requester_id,
    // ...
  }).eq('id', conversationId);

  // Criar acesso compartilhado como fallback
  await supabase.from('shared_conversations').insert({
    conversation_id: conversationId,
    shared_by: user.id,
    shared_with: request.requester_id,
  });
}
```

## Arquivos Modificados

1. `src/hooks/useContactRequests.ts` - Corrigir logica de aprovacao
2. `src/components/conversations/ContactRequestModal.tsx` - Vincular conversa ativa ao criar requisicao

## Complexidade

Media-baixa. Alteracoes em 2 arquivos, sem migracao SQL.

