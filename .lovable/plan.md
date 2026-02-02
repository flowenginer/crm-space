

# Plano: Corrigir Recebimento de Mensagens de Contato (vCard) na UAZAPI

## Resumo do Problema

O canal MASTER-LEADS usa a UAZAPI (não-oficial) e não está processando corretamente mensagens de contato (vCard). A investigação revelou:

1. **O webhook UAZAPI detecta** o tipo `"contact"` corretamente
2. **Problema 1**: Salva `message_type = 'contact'` (singular) mas o frontend espera `'contacts'` (plural)
3. **Problema 2**: Extrai conteúdo como apenas `"[Contato]"` sem extrair nome/telefone do vCard
4. **O webhook CloudAPI** (API oficial) funciona porque extrai `📇 Nome (+55 99 9999-9999)` e usa tipo `'contacts'`

---

## Solução

### Etapa 1: Corrigir o Tipo de Mensagem (contact → contacts)

Modificar a função `detectUAZAPIMessageTypeNew` para retornar `'contacts'` (plural) em vez de `'contact'`:

```typescript
// ANTES
if (matchesType(messageType, "vcard", "contact")) {
  return "contact";  // singular
}

// DEPOIS  
if (matchesType(messageType, "vcard", "contact")) {
  return "contacts";  // plural - compatível com CloudAPI e frontend
}
```

Também atualizar o TypeScript `MessageType` para incluir `'contacts'`:

```typescript
// ANTES
type MessageType = "text" | "image" | "audio" | "video" | "document" | "sticker" | "location" | "contact";

// DEPOIS
type MessageType = "text" | "image" | "audio" | "video" | "document" | "sticker" | "location" | "contact" | "contacts";
```

---

### Etapa 2: Extrair Dados do vCard na UAZAPI

Modificar a função `extractUAZAPIContentNew` para extrair nome e telefone do vCard:

```typescript
case "contacts":
  // Tentar extrair dados do vCard
  const vcard = msg.vcard || msg.content?.vcard || msg.contactMessage?.vcard || '';
  const contacts = msg.contacts || msg.content?.contacts || [];
  
  // Se tiver array de contacts (formato CloudAPI-like)
  if (contacts.length > 0) {
    const c = contacts[0];
    const name = c.name?.formatted_name || c.name?.first_name || c.displayName || 'Contato';
    const phone = c.phones?.[0]?.phone || c.phones?.[0]?.wa_id || '';
    return `📇 ${name}${phone ? ` (${phone})` : ''}`;
  }
  
  // Se tiver vCard string, fazer parse
  if (vcard) {
    const nameMatch = vcard.match(/FN:(.+)/);
    const phoneMatch = vcard.match(/TEL[^:]*:([+\d\s\-()]+)/);
    const name = nameMatch?.[1]?.trim() || 'Contato';
    const phone = phoneMatch?.[1]?.trim() || '';
    return `📇 ${name}${phone ? ` (${phone})` : ''}`;
  }
  
  // Se tiver displayName direto
  if (msg.displayName || msg.content?.displayName) {
    return `📇 ${msg.displayName || msg.content?.displayName}`;
  }
  
  return "[Contato]";  // Fallback
```

---

### Etapa 3: Aplicar Mesmas Correções para Evolution API

Atualizar `detectEvolutionMessageType` e `extractEvolutionContent`:

```typescript
// Em detectEvolutionMessageType
if (message.contactMessage || message.contactsArrayMessage) return "contacts";

// Em extractEvolutionContent
case "contacts":
  const contactMsg = message?.contactMessage;
  const contactsArray = message?.contactsArrayMessage?.contacts;
  
  if (contactsArray && contactsArray.length > 0) {
    const c = contactsArray[0];
    return `📇 ${c.displayName || 'Contato'}`;
  }
  
  if (contactMsg) {
    const vcard = contactMsg.vcard || '';
    const nameMatch = vcard.match(/FN:(.+)/);
    const phoneMatch = vcard.match(/TEL[^:]*:([+\d\s\-()]+)/);
    const name = nameMatch?.[1]?.trim() || contactMsg.displayName || 'Contato';
    const phone = phoneMatch?.[1]?.trim() || '';
    return `📇 ${name}${phone ? ` (${phone})` : ''}`;
  }
  
  return "[Contato]";
```

---

### Etapa 4: Corrigir o Frontend para Aceitar Ambos os Tipos

Modificar `Conversations.tsx` para aceitar tanto `'contact'` quanto `'contacts'`:

```typescript
{/* Contact (vCard) messages - styled card */}
{(message.message_type === 'contacts' || message.message_type === 'contact') && message.content && (
  <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg border border-border/50">
    ...
  </div>
)}
```

---

### Etapa 5: Adicionar Logs de Debug

Adicionar logs quando mensagem de contato é detectada para facilitar debug:

```typescript
if (matchesType(messageType, "vcard", "contact")) {
  console.log(`[Webhook UAZAPI] 📇 Detected CONTACT - vcard: ${msg.vcard?.substring(0, 100)}, contacts: ${JSON.stringify(msg.contacts)?.substring(0, 200)}`);
  return "contacts";
}
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/whatsapp-webhook/index.ts` | Corrigir tipo `contact` → `contacts`, extrair dados vCard |
| `src/pages/Conversations.tsx` | Aceitar `message_type === 'contact'` também |

---

## Benefícios

1. **Compatibilidade**: Mensagens de contato funcionarão em todos os providers (CloudAPI, UAZAPI, Evolution)
2. **Informação**: Exibirá nome e telefone do contato compartilhado, não apenas "[Contato]"
3. **Consistência**: Todos os webhooks usarão o mesmo padrão de tipo e formatação

---

## Seção Técnica

### Formato vCard no WhatsApp

O WhatsApp envia vCards no formato padrão vCard 3.0:

```
BEGIN:VCARD
VERSION:3.0
N:Sobrenome;Nome;;;
FN:Nome Completo
TEL;type=CELL;waid=5521999999999:+55 21 99999-9999
END:VCARD
```

A regex `FN:(.+)` extrai o nome formatado e `TEL[^:]*:([+\d\s\-()]+)` extrai o telefone.

### Por que `contacts` (plural)?

A Meta Cloud API usa `'contacts'` porque o WhatsApp suporta enviar múltiplos contatos de uma vez (`contactsArrayMessage`). Para manter compatibilidade, todos os providers devem usar o mesmo tipo.

