

# Plano: Correção da Transmissão SDP Answer para Chamadas Outbound

## Resumo do Problema

O áudio não está funcionando nas chamadas outbound porque o **SDP Answer enviado pela Meta via webhook não está chegando ao frontend**. A investigação revelou:

1. ✅ Meta envia corretamente o SDP Answer via webhook (evento `connect` com `sdp_type: answer`)
2. ✅ O webhook processa e tenta fazer broadcast via Supabase Realtime
3. ❌ O broadcast falha silenciosamente (log: "Realtime send() is automatically falling back to REST API")
4. ❌ Sem o SDP Answer, o WebRTC não completa o handshake e não há áudio

### Causa Raiz
O `supabase.channel().send()` em Edge Functions requer que o canal esteja **subscrito** antes de enviar. Sem subscription prévia, o Supabase usa fallback REST que não é confiável para broadcasts em tempo real.

---

## Solução Proposta

### Estratégia Multi-Camada

1. **Subscrição prévia no backend** - Garantir que o canal seja subscrito antes de enviar
2. **Fallback via polling** - Se o broadcast falhar, buscar SDP via HTTP
3. **Persistência do SDP** - Salvar o SDP Answer no banco para recuperação

---

## Etapa 1: Melhorar o Broadcast no Webhook

### Arquivo: `supabase/functions/cloudapi-webhook/index.ts`

Modificar a lógica de broadcast para aguardar subscription antes de enviar:

```typescript
// ANTES (problemático)
await supabase.channel('call-events').send({...})

// DEPOIS (com subscription)
const channel = supabase.channel('call-events');

// Aguardar subscription antes de enviar
await new Promise<void>((resolve, reject) => {
  const timeout = setTimeout(() => {
    console.error('[Calls] Channel subscription timeout');
    resolve(); // Continua mesmo com timeout
  }, 3000);
  
  channel.subscribe((status) => {
    clearTimeout(timeout);
    if (status === 'SUBSCRIBED') {
      resolve();
    } else if (status === 'CHANNEL_ERROR') {
      console.error('[Calls] Channel subscription error');
      resolve();
    }
  });
});

// Agora enviar o broadcast
await channel.send({
  type: 'broadcast',
  event: 'call_state_changed',
  payload: { callId, sdpAnswer, ... }
});

// Cleanup
await supabase.removeChannel(channel);
```

---

## Etapa 2: Persistir SDP Answer no Banco

### Modificação na tabela `call_logs`

Adicionar coluna para armazenar o SDP Answer como fallback:

```sql
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS sdp_answer TEXT;
```

### No webhook, salvar o SDP:

```typescript
if (isOutboundAccepted && session?.sdp) {
  await supabase
    .from('call_logs')
    .update({ sdp_answer: session.sdp })
    .eq('whatsapp_call_id', callId);
}
```

---

## Etapa 3: Implementar Fallback via Polling no Frontend

### Arquivo: `src/hooks/useWebRTCCall.ts`

Adicionar função para buscar SDP do banco caso o broadcast não chegue:

```typescript
const pollForSdpAnswer = useCallback(async (
  callId: string, 
  maxAttempts = 10
): Promise<string | null> => {
  for (let i = 0; i < maxAttempts; i++) {
    const { data } = await supabase
      .from('call_logs')
      .select('sdp_answer')
      .eq('whatsapp_call_id', callId)
      .single();
    
    if (data?.sdp_answer) {
      console.log('[WebRTC] ✅ Got SDP answer via polling');
      return data.sdp_answer;
    }
    
    await new Promise(r => setTimeout(r, 1000)); // Esperar 1s
  }
  return null;
}, []);
```

---

## Etapa 4: Integrar Polling no Fluxo de Chamada

### Arquivo: `src/hooks/useWebRTCCall.ts`

Na função `initiateCall`, após receber o `call_id`:

```typescript
// Após setState com callId e status 'ringing'
// Iniciar polling em paralelo como fallback

const pollPromise = pollForSdpAnswer(data.call_id);

// Timeout: se não receber via Realtime em 5s, usar polling
setTimeout(async () => {
  if (peerConnectionRef.current?.signalingState !== 'stable') {
    console.log('[WebRTC] No SDP via Realtime, trying polling...');
    const sdp = await pollPromise;
    if (sdp) {
      await setSdpAnswer(sdp);
    }
  }
}, 5000);
```

---

## Etapa 5: Garantir Subscription Prévia no CallProvider

### Arquivo: `src/providers/CallProvider.tsx`

Modificar para garantir que o canal esteja inscrito ANTES de iniciar chamadas:

```typescript
// Adicionar ref para controlar estado de subscription
const isChannelReady = useRef(false);

useEffect(() => {
  if (!user) return;

  const eventsChannel = supabase
    .channel('call-events')
    .on('broadcast', { event: 'call_state_changed' }, async (payload) => {
      // ... handler existente
    })
    .subscribe((status) => {
      console.log('[CallProvider] call-events channel status:', status);
      isChannelReady.current = status === 'SUBSCRIBED';
    });

  // ... resto do código
}, [user, ...]);

// Na initiateCall, aguardar canal pronto
const initiateCall = useCallback(async (...) => {
  // Verificar se canal está pronto
  if (!isChannelReady.current) {
    console.warn('[CallProvider] Channel not ready, waiting...');
    await new Promise(r => setTimeout(r, 500));
  }
  
  await initiate(toNumber, contactId, contactName);
}, [...]);
```

---

## Etapa 6: Adicionar Logs Detalhados

### Em ambos os lados, adicionar logs para diagnóstico:

**Backend (webhook):**
```typescript
console.log('[Calls] 📡 Broadcasting SDP answer:', {
  callId,
  sdpLength: session.sdp.length,
  channelStatus: 'SUBSCRIBED'
});
```

**Frontend (CallProvider):**
```typescript
console.log('[CallProvider] 📥 Received call event:', {
  callId: receivedCallId,
  hasSdpAnswer: !!sdpAnswer,
  myCallId: callState.callId,
  willProcess: sdpAnswer && callState.callId === receivedCallId
});
```

---

## Diagrama do Fluxo Corrigido

```text
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend      │     │   Edge Function  │     │   Meta/WhatsApp │
│  (CallProvider) │     │    (webhook)     │     │                 │
└────────┬────────┘     └────────┬─────────┘     └────────┬────────┘
         │                       │                        │
         │ 1. Subscribe          │                        │
         │  'call-events'        │                        │
         ├───────────────────────┤                        │
         │                       │                        │
         │ 2. initiateCall()     │                        │
         ├──────────────────────>│ 3. POST /calls         │
         │                       ├───────────────────────>│
         │                       │                        │
         │                       │ 4. Webhook: connect    │
         │                       │    + SDP Answer        │
         │                       │<───────────────────────┤
         │                       │                        │
         │                       │ 5. Subscribe channel   │
         │                       │    + broadcast         │
         │                       │                        │
         │ 6. Receive SDP        │                        │
         │<──────────────────────┤                        │
         │                       │                        │
         │ 7. setRemoteDesc()    │                        │
         │    WebRTC completo!   │                        │
         │                       │                        │
         │        OU (fallback)  │                        │
         │                       │                        │
         │ 8. Polling call_logs  │                        │
         ├──────────────────────>│                        │
         │<──────────────────────┤                        │
         │ SDP from database     │                        │
         │                       │                        │
         │ 9. setRemoteDesc()    │                        │
         │    WebRTC completo!   │                        │
         └───────────────────────┴────────────────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/cloudapi-webhook/index.ts` | Subscription prévia + salvar SDP no banco |
| `src/hooks/useWebRTCCall.ts` | Adicionar polling fallback |
| `src/providers/CallProvider.tsx` | Garantir channel ready antes de chamar |
| Nova migration SQL | Adicionar coluna `sdp_answer` em `call_logs` |

---

## Benefícios

1. **Confiabilidade**: Fallback via polling garante que SDP sempre chegue
2. **Diagnóstico**: Logs detalhados facilitam debug futuro
3. **Persistência**: SDP salvo no banco permite recuperação mesmo após refresh
4. **Compatibilidade**: Funciona mesmo se Realtime tiver problemas temporários

---

## Seção Técnica

### Por que o broadcast falha?

O Supabase Realtime em Edge Functions usa WebSocket quando o canal está subscrito, ou fallback HTTP quando não está. O fallback HTTP é "fire-and-forget" e não garante entrega, especialmente se:
- O cliente não está inscrito no mesmo canal
- Há latência na conexão
- O canal usa nome dinâmico

### Alternativa Considerada: Database Trigger

Poderia usar `realtime.broadcast_changes()` via trigger SQL, mas:
- Requer configuração adicional de RLS
- Menos flexível para payload customizado
- O polling como fallback é mais simples e confiável

