

# Correção: Detecção de Resposta de Permissão de Chamada

## Problema Identificado

A resposta de permissão de chamada **está chegando corretamente** no webhook da Meta, porém o formato é diferente do esperado:

### Formato Real (Meta envia)
```json
{
  "type": "interactive",
  "interactive": {
    "type": "call_permission_reply",
    "call_permission_reply": {
      "response": "accept",
      "is_permanent": true,
      "response_source": "user_action"
    }
  }
}
```

### Formato Esperado (código atual procura)
```json
{
  "type": "interactive",
  "interactive": {
    "type": "button_reply",
    "button_reply": {
      "id": "call_permission_granted"
    }
  }
}
```

## Solução

Atualizar o webhook `cloudapi-webhook` para detectar o tipo correto `call_permission_reply`.

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `supabase/functions/cloudapi-webhook/index.ts` | Adicionar tratamento para `call_permission_reply` |

## Mudança no Código

No arquivo `cloudapi-webhook/index.ts`, adicionar uma nova condição dentro do `case 'interactive':` (por volta da linha 529):

### Código a Adicionar
```typescript
} else if (message.interactive?.call_permission_reply) {
  // Native call permission response from Meta
  const callPermReply = message.interactive.call_permission_reply;
  console.log('[CloudAPI] Call permission reply received:', JSON.stringify(callPermReply, null, 2));
  
  // Check if permission was granted
  // response can be: "accept" (granted) or "decline" (denied)
  const permissionGranted = callPermReply.response === 'accept';
  
  if (permissionGranted) {
    console.log('[CloudAPI] 📞 Call permission GRANTED via call_permission_reply');
    await updateCallPermissionStatus(supabase, from, config.tenant_id, 'granted');
    content = '✅ Permissão de chamada concedida';
  } else {
    console.log('[CloudAPI] 📞 Call permission DENIED via call_permission_reply');
    await updateCallPermissionStatus(supabase, from, config.tenant_id, 'denied');
    content = '❌ Permissão de chamada negada';
  }
  
  messageType = 'interactive';
}
```

## Fluxo Após Correção

```text
Usuário aceita permissão no WhatsApp
           │
           ▼
  Meta envia webhook com:
  interactive.type = "call_permission_reply"
  call_permission_reply.response = "accept"
           │
           ▼
  Webhook detecta call_permission_reply
           │
           ▼
  updateCallPermissionStatus(supabase, phone, tenantId, 'granted')
           │
           ▼
  contacts.call_permission_status → 'granted'
           │
           ▼
  Supabase Realtime notifica frontend
           │
           ▼
  UI atualiza: botão "Ligar" liberado ✅
```

## Benefício Adicional

Após a correção, **não será necessário solicitar permissão novamente** para o contato Michel Santos. O status já foi aceito 2x (17:35:55 e 17:37:29), então basta rodar uma query manual para corrigir o estado atual:

```sql
UPDATE contacts 
SET call_permission_status = 'granted'
WHERE phone = '5521992731918';
```

(Isso será feito automaticamente pelo código após a correção, para novos eventos)

## Resumo

- **Causa raiz**: O código esperava `button_reply` ou `nfm_reply`, mas a Meta envia `call_permission_reply`
- **Impacto**: Todas as respostas de permissão estavam sendo ignoradas
- **Solução**: Adicionar handler para `call_permission_reply` no webhook
- **Complexidade**: Baixa (adicionar ~15 linhas de código)

