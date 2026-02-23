

## Plano: Otimizar velocidade de envio de mensagens no Chat Interno

### Problema Identificado

Ao enviar qualquer tipo de mensagem (texto, link, PDF, foto, audio), o sistema aguarda a resposta completa do servidor antes de exibir a mensagem na tela. O fluxo atual:

1. Usuário envia mensagem
2. Aguarda INSERT no banco (Supabase)
3. `onSuccess` dispara `invalidateQueries` para mensagens E threads
4. Aguarda refetch completo de TODAS as mensagens da thread
5. Só então a mensagem aparece na tela

Isso causa uma demora perceptível, especialmente com mídias (upload + insert + refetch).

### Solução: Optimistic Updates

Implementar atualizações otimistas no React Query - a mensagem aparece **instantaneamente** na tela enquanto o envio acontece em background.

### Detalhes Técnicos

**Arquivo: `src/hooks/useInternalChat.ts`**

1. **`useSendInternalMessage`** - Adicionar `onMutate` para inserir a mensagem imediatamente no cache local:
   - Criar um objeto de mensagem temporária com ID provisório e flag `isPending`
   - Usar `queryClient.setQueryData` para adicionar ao array de mensagens existente
   - No `onSuccess`, substituir a mensagem temporária pela real (com ID do servidor)
   - No `onError`, reverter o cache ao estado anterior
   - Remover `invalidateQueries` de mensagens do `onSuccess` (o realtime já cuida disso)

2. **`useUploadInternalChatMedia`** - Sem mudança, mas o fluxo em `InternalChatInput` será ajustado para mostrar um placeholder de "enviando..." enquanto o upload acontece.

3. **`useInternalChatRealtime`** - Ajustar para fazer merge inteligente:
   - Quando receber uma mensagem via realtime que já existe no cache (mensagem otimista), substituir ao invés de duplicar
   - Evitar `invalidateQueries` desnecessário quando a mensagem já está no cache

**Arquivo: `src/components/internal-chat/InternalChatInput.tsx`**

4. Para uploads de mídia, mostrar preview/placeholder instantâneo na lista de mensagens antes do upload completar.

**Arquivo: `src/components/internal-chat/InternalChatMessageItem.tsx`**

5. Adicionar indicador visual sutil (opacidade reduzida ou ícone de relógio) para mensagens em estado `isPending`.

### Resultado Esperado

- Mensagens de texto aparecem **instantaneamente** ao pressionar Enter
- Mensagens de mídia mostram placeholder imediato com indicador de progresso
- Se o envio falhar, a mensagem é removida e o texto é restaurado no input
- Sem duplicação de mensagens (merge com realtime)

