

# Implementar "Marcar como Lida" (duplo check azul) para API nao oficial (UAZAPI)

## Problema
Quando um atendente abre uma conversa ou envia uma mensagem, o sistema marca a conversa como "lida" apenas no banco de dados interno. Porem, no WhatsApp do lead, as mensagens continuam sem o duplo check azul (nao aparecem como "lidas"). Isso acontece porque o sistema nunca chama o endpoint `/message/markread` da UAZAPI.

## Solucao
Chamar o endpoint `POST /message/markread` da UAZAPI sempre que um atendente abrir/visualizar uma conversa. Isso envia o sinal de "leitura" para o WhatsApp do lead, mostrando os checks azuis.

## Arquitetura

O fluxo sera:
1. Atendente abre uma conversa no CRM
2. Frontend chama edge function para marcar mensagens como lidas na UAZAPI
3. Edge function busca as mensagens nao lidas (recebidas do lead) com `whatsapp_message_id`
4. Chama `POST {baseUrl}/message/markread` com os IDs das mensagens
5. Lead ve os checks azuis no WhatsApp

## Implementacao

### 1. Nova action `markAsRead` na edge function `whatsapp-instance`
- Adicionar um novo case `markAsRead` que recebe `channelId` e `conversationId`
- Busca as ultimas mensagens recebidas (`is_from_me = false`) com `whatsapp_message_id` nao nulo
- Para canais UAZAPI: chama `POST {baseUrl}/message/markread` com `{ "id": [ids] }` e header `token`
- Para canais Evolution: chamar o endpoint equivalente (se existir)
- Para canais Z-API: chamar o endpoint equivalente (se existir)

### 2. Funcao helper `markMessagesAsRead` no frontend
- Criar funcao em `src/lib/whatsapp/instance-creator.ts` que invoca a edge function com action `markAsRead`
- Recebe `channelId` e `conversationId`

### 3. Integrar no fluxo de abertura de conversa
- Em `src/pages/Conversations.tsx`, quando o usuario seleciona uma conversa, chamar `markMessagesAsRead` em background (fire-and-forget)
- Somente para canais nao-oficiais (UAZAPI, Evolution, Z-API)
- Debounce para evitar chamadas excessivas

### 4. Tambem marcar ao enviar mensagem
- Quando o atendente envia uma mensagem, marcar as mensagens anteriores do lead como lidas (se ainda nao foram)

## Arquivos Alterados

1. **`supabase/functions/whatsapp-instance/index.ts`** - Adicionar action `markAsRead` com logica para UAZAPI (`/message/markread`), Evolution e Z-API
2. **`src/lib/whatsapp/instance-creator.ts`** - Adicionar funcao `markMessagesAsReadOnWhatsApp(channelId, conversationId)`
3. **`src/pages/Conversations.tsx`** - Chamar mark as read quando usuario abre conversa

## Detalhes Tecnicos

**Endpoint UAZAPI (conforme documentacao):**
```text
POST {baseUrl}/message/markread
Headers: { "Content-Type": "application/json", "token": "{instanceToken}" }
Body: { "id": ["62AD1AD844E518180227BF68DA7ED710", "..."] }
```

**Consulta SQL para buscar IDs das mensagens nao lidas:**
```text
SELECT whatsapp_message_id FROM messages
WHERE conversation_id = ? AND is_from_me = false AND whatsapp_message_id IS NOT NULL
ORDER BY created_at DESC LIMIT 50
```

A chamada sera fire-and-forget (nao bloqueia a UI) e com tratamento de erro silencioso para nao impactar a experiencia do usuario.

