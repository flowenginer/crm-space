
# Plano: Corrigir Mudança de Canal de API Não Oficial para API Oficial

## Problema Identificado

Ao tentar mudar o canal de uma conversa de API Não Oficial para API Oficial no tenant Space Sports, a operação não está funcionando. A análise do código revelou os seguintes pontos:

1. **Erro silencioso**: O catch block apenas exibe "Erro ao alterar canal" sem mostrar o erro real
2. **Falta de validação**: O código assume que `selectedConversation?.contact_id` existe, mas não verifica
3. **Falta de logging**: Não há logs de console para debugar o problema

## Dados Verificados

- O canal `API_Oficial` existe e está `connected` (ID: ee310180-2ead-49c2-bb8a-4d2e334a872f)
- As políticas RLS de UPDATE para `conversations` parecem corretas (WITH CHECK: true)
- Existem conversas com canais não oficiais que podem ser migradas

## Solução Proposta

Melhorar o código de mudança de canal com:

1. **Logging detalhado** para diagnóstico
2. **Validação de dados** antes de executar operações
3. **Mensagens de erro mais claras** mostrando o erro real
4. **Invalidação adicional de queries** para garantir atualização da UI

### Alterações no Arquivo

**Arquivo:** `src/pages/Conversations.tsx`

**Mudança 1 - Bloco de mudança para canais NÃO oficiais (linhas 4699-4731):**

Adicionar logging e melhorar tratamento de erros:
- Log do canal atual e destino
- Validação de `contact_id` antes de consultar duplicatas
- Mostrar erro detalhado no toast e console

**Mudança 2 - Bloco de mudança para canal OFICIAL (linhas 6469-6515):**

Adicionar as mesmas melhorias:
- Log detalhado antes de cada operação
- Validação de `contact_id`
- Erro detalhado mostrando a mensagem do Supabase

## Detalhes Técnicos

### Código Atual (problema)
```typescript
try {
  const { data: existingConv } = await supabase
    .from('conversations')
    .select('id')
    .eq('contact_id', selectedConversation?.contact_id)  // Pode ser undefined!
    .eq('channel_id', channelChangeDialog.channel.id)
    ...
} catch (error) {
  toast.error('Erro ao alterar canal');  // Erro genérico
}
```

### Código Corrigido
```typescript
try {
  console.log('[ChannelChange] Iniciando mudança de canal:', {
    conversationId: selectedConversationId,
    contactId: selectedConversation?.contact_id,
    fromChannel: selectedConversation?.channel_id,
    toChannel: channelChangeDialog.channel.id,
    toChannelName: channelChangeDialog.channel.name
  });

  // Validar contact_id antes de consultar
  if (!selectedConversation?.contact_id) {
    toast.error('Erro: Contato não encontrado para esta conversa');
    console.error('[ChannelChange] contact_id missing from selectedConversation');
    return;
  }

  const { data: existingConv, error: checkError } = await supabase
    .from('conversations')
    .select('id')
    .eq('contact_id', selectedConversation.contact_id)
    .eq('channel_id', channelChangeDialog.channel.id)
    ...

  if (checkError) {
    console.error('[ChannelChange] Error checking existing conv:', checkError);
    throw checkError;
  }

  // ... resto do código ...

} catch (error: any) {
  console.error('[ChannelChange] Erro ao alterar canal:', error);
  toast.error(`Erro ao alterar canal: ${error?.message || 'Erro desconhecido'}`);
}
```

## Resumo

- **1 arquivo alterado**: `src/pages/Conversations.tsx`
- **2 blocos de código modificados**: Mudança para canais não-oficiais e mudança para canais oficiais
- **Benefício principal**: Diagnóstico preciso do erro real
- **Risco**: Nenhum - as mudanças são aditivas (logging e validação extra)

## Próximos Passos Após Deploy

1. Tentar novamente a mudança de canal
2. Verificar o console do navegador para ver o log detalhado
3. Se o erro persistir, os logs mostrarão exatamente o que está falhando (RLS, duplicata, ou outro problema)
