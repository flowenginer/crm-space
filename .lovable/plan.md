
# Plano: Enviar Texto como Legenda da Imagem (Caption)

## Problema Identificado

Quando o usuário adiciona uma foto + texto:
1. ❌ A imagem é enviada como mensagem separada com o **nome do arquivo** como conteúdo
2. ❌ O texto é enviado como **segunda mensagem** separada
3. ❌ No WhatsApp do cliente, aparecem 2 mensagens em vez de 1 imagem com legenda

**Comportamento esperado:** Uma única mensagem com a imagem e o texto como legenda (caption)

## Causa Raiz

No arquivo `src/pages/Conversations.tsx` (linhas 3048-3102):

```typescript
// PROBLEMA 1: Usa o nome do arquivo como conteúdo
content: file.name,  // ❌ Deveria ser a legenda

// PROBLEMA 2: Envia texto separado depois dos arquivos
if (hasText) {
  // Envia como mensagem separada ❌
  sendMessage.mutateAsync({ content: textContent, message_type: 'text' });
}
```

## Solução Proposta

### Alteração no Arquivo

**Arquivo:** `src/pages/Conversations.tsx`

**Lógica nova:**
1. Se tem 1 arquivo de imagem/vídeo E tem texto → usar texto como caption, NÃO enviar texto separado
2. Se tem múltiplos arquivos → usar caption apenas no primeiro arquivo de imagem/vídeo
3. Se arquivo é áudio/documento → NÃO usar caption (manter comportamento atual)
4. Nunca exibir o nome do arquivo como conteúdo da imagem/vídeo

### Mudanças Específicas

**Bloco de envio de arquivos (linhas 3048-3108):**

```typescript
// Para arquivos, precisamos fazer upload primeiro
let captionUsed = false;  // Controla se já usou o caption

for (const file of selectedFiles) {
  const result = await uploadAttachment(file, selectedConversationId);
  
  let messageType = 'document';
  if (file.type.startsWith('image/')) {
    messageType = 'image';
  } else if (file.type.startsWith('video/')) {
    messageType = 'video';
  } else if (file.type.startsWith('audio/')) {
    messageType = 'audio';
  }

  // Determinar conteúdo: caption para imagem/vídeo, marcador para outros
  let messageContent: string;
  let captionForWhatsApp: string | undefined;
  
  if ((messageType === 'image' || messageType === 'video') && hasText && !captionUsed) {
    // Usar texto como legenda para imagem/vídeo
    const textContent = messageInput.trim();
    messageContent = addSignatureToContent(textContent);
    captionForWhatsApp = messageContent;
    captionUsed = true;  // Marcar que já usou o caption
  } else {
    // Marcador padrão ou nome do arquivo para documentos
    if (messageType === 'image') messageContent = '[Imagem]';
    else if (messageType === 'video') messageContent = '[Vídeo]';
    else if (messageType === 'audio') messageContent = '[Áudio]';
    else messageContent = file.name;  // Documentos mantém o nome
  }

  // Salvar no banco com o conteúdo correto
  sendMessage.mutateAsync({
    conversation_id: selectedConversationId,
    content: messageContent,
    is_from_me: true,
    message_type: messageType,
    media_url: result.url,
    media_mime_type: result.mimeType,
    reply_to_message_id: replyingTo?.id,
  }).then(async (savedMessage) => {
    // Enviar via WhatsApp com caption
    const whatsAppId = await sendViaWhatsApp(
      captionForWhatsApp || '', 
      messageType, 
      result.url, 
      quotedWhatsAppId,
      messageType === 'document' ? file.name : undefined
    );
    
    if (whatsAppId && savedMessage?.id) {
      updateMessageWhatsAppId(savedMessage.id, whatsAppId, 'sent');
    }
  }).catch(console.error);
}

// Enviar texto separado SOMENTE se não foi usado como caption
if (hasText && !captionUsed) {
  // ... código existente para enviar texto separado
}
```

## Resultado Esperado

| Cenário | Antes | Depois |
|---------|-------|--------|
| 1 imagem + texto | 2 msgs: [Captura_de_Tela...png] + "TExto" | 1 msg: Imagem com legenda "TExto" |
| 1 imagem sem texto | 1 msg: [Captura_de_Tela...png] | 1 msg: Imagem com marcador "[Imagem]" |
| 2+ imagens + texto | 3+ msgs | 1ª imagem com caption, demais só imagem |
| 1 documento + texto | 2 msgs: [nome.pdf] + "texto" | 2 msgs (doc não suporta caption bem) |

## Arquivos Modificados

- **1 arquivo**: `src/pages/Conversations.tsx`
- **Linhas afetadas**: ~3048-3108 (bloco de envio de arquivos)

## Compatibilidade

- ✅ CloudAPI (API Oficial): Suporta caption via parâmetro `caption`
- ✅ Evolution API: Suporta caption via campo `caption`
- ✅ UAZAPI: Suporta caption via campo `caption`
- ✅ Z-API: Suporta caption via campo `caption`
- ✅ Todas as Edge Functions já estão preparadas para receber caption

## Impacto Visual no CRM

A renderização no CRM já suporta caption para imagens/vídeos (linhas 1042-1049):
```typescript
{/* Caption for images */}
{message.message_type === 'image' && message.content && message.content !== '[Imagem]' && (
  <p className="text-sm leading-relaxed mt-2">{message.content}</p>
)}
```

Ou seja, quando `content` for diferente de "[Imagem]", ele já renderiza como legenda abaixo da imagem.
