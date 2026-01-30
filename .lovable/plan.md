
# Fluxo de Permissão de Chamada - Call Permission Request

## Contexto do Problema

Quando o CRM tenta iniciar uma chamada para um contato, a Meta retorna o erro **138006** ("No approved call permission from the recipient"). Isso acontece porque a **Calling API da Meta** exige que o usuário final **aceite explicitamente** receber chamadas da empresa antes que uma chamada possa ser iniciada.

## Solução Proposta

Implementar um fluxo completo onde:
1. O atendente solicita permissão de chamada ao contato (via mensagem interativa)
2. O contato recebe a mensagem e pode aceitar ou recusar
3. O sistema detecta a resposta e armazena o status de permissão
4. O botão de chamada só é habilitado após permissão concedida

---

## Arquitetura da Solução

```text
┌──────────────────┐     ┌─────────────────────┐     ┌────────────────┐
│  ConversationUI  │────▶│ RequestCallPermBtn  │────▶│ cloudapi-send  │
│  (Sidebar)       │     │ (Novo Componente)   │     │ -call-request  │
└──────────────────┘     └─────────────────────┘     └───────┬────────┘
                                                              │
                                                              ▼
                                                     ┌────────────────┐
                                                     │  Meta Graph    │
                                                     │  API           │
                                                     └───────┬────────┘
                                                              │
                                                              ▼
                                                     ┌────────────────┐
                                                     │  cloudapi-     │
                                                     │  webhook       │
                                                     └───────┬────────┘
                                                              │
                                                              ▼
                                                     ┌────────────────┐
                                                     │ contacts.      │
                                                     │ call_permission│
                                                     │ _status        │
                                                     └────────────────┘
```

---

## Etapas de Implementação

### 1. Banco de Dados - Adicionar campo `call_permission_status`

Criar coluna na tabela `contacts` para armazenar o status de permissão de chamada:

- **Campo**: `call_permission_status` (TEXT)
- **Valores possíveis**: 
  - `null` - Nunca solicitado
  - `pending` - Solicitação enviada, aguardando resposta
  - `granted` - Permissão concedida
  - `denied` - Permissão negada
- **Campo adicional**: `call_permission_requested_at` (TIMESTAMP) - Para saber quando foi a última solicitação

**SQL:**
```sql
ALTER TABLE contacts 
ADD COLUMN call_permission_status TEXT DEFAULT NULL,
ADD COLUMN call_permission_requested_at TIMESTAMPTZ DEFAULT NULL;
```

---

### 2. Nova Edge Function - `cloudapi-send-call-permission-request`

Cria e envia uma mensagem interativa (tipo `call_permission_request`) via Graph API da Meta:

**Endpoint da Meta:**
```
POST /{phone_number_id}/messages
```

**Payload:**
```json
{
  "messaging_product": "whatsapp",
  "to": "5521999999999",
  "type": "interactive",
  "interactive": {
    "type": "call_permission_request",
    "body": {
      "text": "Olá! Podemos ligar para você quando necessário para atendimento? Clique abaixo para autorizar."
    },
    "action": {
      "name": "call_permission_request"
    }
  }
}
```

**Responsabilidades:**
- Validar autenticação
- Buscar configuração CloudAPI do tenant
- Formatar telefone
- Enviar mensagem interativa
- Atualizar `contacts.call_permission_status` para `pending`
- Registrar mensagem no banco (tabela `messages`)

---

### 3. Atualizar Webhook - `cloudapi-webhook`

Adicionar detecção de respostas de permissão de chamada no webhook:

**Tipos de resposta da Meta para call_permission:**
- `button_reply.id === "call_permission_granted"` ou similar
- A Meta envia um evento de `interactive` com a resposta do usuário

**Ação ao detectar resposta:**
```typescript
// Se usuário aceitou:
await supabase
  .from('contacts')
  .update({ call_permission_status: 'granted' })
  .eq('phone', contactPhone);

// Se usuário recusou:
await supabase
  .from('contacts')
  .update({ call_permission_status: 'denied' })
  .eq('phone', contactPhone);
```

---

### 4. Novo Componente - `RequestCallPermissionButton`

Botão que aparece ao lado do `InitiateCallButton` quando o contato ainda não deu permissão:

**Localização:** `src/components/calls/RequestCallPermissionButton.tsx`

**Lógica:**
- Se `call_permission_status === 'granted'` → Não mostra (só mostra o botão de ligar)
- Se `call_permission_status === 'pending'` → Mostra badge "Aguardando resposta"
- Se `call_permission_status === null` ou `denied` → Mostra botão "Solicitar permissão"

**UI:**
```tsx
<Button variant="outline" size="sm">
  <PhoneForwarded className="h-4 w-4 mr-2" />
  Solicitar permissão
</Button>
```

---

### 5. Atualizar `InitiateCallButton`

Modificar para verificar permissão antes de iniciar chamada:

**Lógica:**
```tsx
// Buscar status de permissão do contato
const { data: contact } = useQuery({
  queryKey: ['contact-call-permission', contactId],
  queryFn: () => supabase.from('contacts').select('call_permission_status').eq('id', contactId).single()
});

const hasPermission = contact?.call_permission_status === 'granted';

// Se não tem permissão, mostrar toast explicativo
if (!hasPermission) {
  toast.error('Solicite permissão de chamada antes de ligar');
  return;
}
```

---

### 6. Atualizar `ConversationSidebar`

Adicionar indicador visual e botões de permissão na área do telefone:

**Localização:** `src/components/conversations/ConversationSidebar.tsx` (linhas ~1240)

**Antes:**
```tsx
<InitiateCallButton contactPhone={contact.phone} ... />
```

**Depois:**
```tsx
<CallPermissionStatus 
  contactId={contact.id}
  contactPhone={contact.phone}
  contactName={contact.full_name}
  conversationId={conversationId}
/>
```

**Componente CallPermissionStatus:**
- Mostra status atual (ícone colorido)
- Mostra botão "Solicitar" se não tem permissão
- Mostra botão "Ligar" se tem permissão
- Mostra badge "Aguardando" se pendente

---

### 7. Atualizar types do Supabase

Regenerar os tipos para incluir os novos campos:
- `call_permission_status`
- `call_permission_requested_at`

---

## Fluxo Visual do Usuário

1. **Sem permissão**: Atendente vê botão "📞 Solicitar permissão" ao lado do telefone
2. **Clica em solicitar**: Sistema envia mensagem interativa para o cliente
3. **Aguardando**: Badge amarelo "Aguardando resposta"
4. **Cliente aceita**: Botão muda para "📞 Ligar" (verde)
5. **Cliente recusa**: Badge vermelho "Permissão negada" + botão para solicitar novamente

---

## Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `supabase/functions/cloudapi-send-call-permission-request/index.ts` | Edge function para enviar solicitação de permissão |
| `src/components/calls/RequestCallPermissionButton.tsx` | Botão de solicitar permissão |
| `src/components/calls/CallPermissionStatus.tsx` | Componente que agrupa status + botões |
| `src/hooks/useCallPermission.ts` | Hook para gerenciar permissão de chamada |

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `supabase/functions/cloudapi-webhook/index.ts` | Detectar resposta de permissão de chamada |
| `src/components/conversations/ConversationSidebar.tsx` | Integrar CallPermissionStatus |
| `src/components/calls/InitiateCallButton.tsx` | Verificar permissão antes de ligar |
| `src/integrations/supabase/types.ts` | Adicionar novos campos |
| `supabase/config.toml` | Registrar nova edge function |

---

## Considerações Técnicas

1. **Mensagem Interativa da Meta**: O tipo exato pode variar. A documentação da Meta para BIC (Business-Initiated Calls) indica o uso de `call_permission_request` como tipo de mensagem interativa.

2. **Fallback**: Se a resposta do cliente não chegar em 24h, manter como `pending` e permitir reenvio.

3. **Permissão por Tenant**: O campo `call_permission_status` é por contato (que já é por tenant), então não há conflito multi-tenant.

4. **Realtime**: Usar Supabase Realtime para atualizar a UI quando o contato responder (já existe padrão similar no projeto).
