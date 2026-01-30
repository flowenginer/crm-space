

# Correção do Áudio Mudo em Chamadas WebRTC

## Diagnóstico

A chamada conecta com sucesso via Meta Cloud API, mas o áudio não funciona porque:

1. **SDP Answer não está chegando ao frontend**: Para chamadas outbound (business-initiated), o Meta envia o SDP answer via webhook, mas o sistema atual **não propaga o SDP answer para o frontend** via Realtime.

2. **O `remoteStream` fica null**: Sem receber o SDP answer, o frontend não consegue completar a negociação WebRTC, então o `pc.ontrack` nunca dispara e o `remoteStream` nunca é populado.

3. **O elemento `<audio>` existe mas não tem stream**: O código do `ActiveCallOverlay.tsx` já tem o elemento de áudio, mas `callState.remoteStream` está null.

## Fluxo Atual (Quebrado)

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                           CHAMADA OUTBOUND                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. Frontend gera SDP Offer ─────────► cloudapi-initiate-call           │
│                                                │                        │
│  2. Meta recebe e responde com call_id ◄───────┘                        │
│                                                                         │
│  3. Cliente aceita a chamada no WhatsApp                                │
│                                                │                        │
│  4. Meta envia webhook com SDP Answer ─────────► cloudapi-webhook       │
│                                                │                        │
│  5. Webhook processa mas NÃO ENVIA para ───────┘ [PROBLEMA AQUI]       │
│     o frontend                                                          │
│                                                                         │
│  6. Frontend fica esperando o remoteStream ──► NUNCA CHEGA              │
│                                                                         │
│  7. Áudio mudo porque RTCPeerConnection ─────► Não tem remote SDP      │
│     nunca recebe a outra ponta                                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Solução Proposta

### 1. Propagar SDP Answer via Realtime

O webhook `cloudapi-webhook` precisa enviar o SDP answer para o frontend quando uma chamada outbound é aceita.

**Arquivo**: `supabase/functions/cloudapi-webhook/index.ts`

**Modificação**: Na função `processCalls`, quando receber status `accepted` para chamada `business_initiated`, incluir o SDP no broadcast:

```typescript
// Broadcast call state changes for active calls
if (['accepted', 'rejected', 'terminated', 'completed', 'failed'].includes(status)) {
  console.log('[Calls] Broadcasting call state change:', status);
  
  await supabase.channel('call-events').send({
    type: 'broadcast',
    event: 'call_state_changed',
    payload: {
      callId,
      callLogId,
      status,
      duration,
      timestamp: timestamp.toISOString(),
      // NOVO: Incluir SDP answer para chamadas outbound aceitas
      sdpAnswer: (status === 'accepted' && direction === 'business_initiated') 
        ? session?.sdp 
        : undefined,
      sdpType: (status === 'accepted' && direction === 'business_initiated')
        ? session?.sdp_type
        : undefined,
    },
  });
}
```

### 2. Receber SDP Answer no Frontend

O `CallProvider` precisa processar o SDP answer e passá-lo para o hook WebRTC.

**Arquivo**: `src/providers/CallProvider.tsx`

**Modificação**: No listener de `call_state_changed`, chamar `setSdpAnswer` quando receber o SDP:

```typescript
const eventsChannel = supabase
  .channel('call-events-listener')
  .on('broadcast', { event: 'call_state_changed' }, async (payload) => {
    console.log('[CallProvider] Call state changed:', payload);
    
    const { callId, status, sdpAnswer } = payload.payload;
    
    // Se recebemos SDP answer para nossa chamada outbound, definir no WebRTC
    if (sdpAnswer && callState.callId === callId && callState.direction === 'outbound') {
      console.log('[CallProvider] Received SDP answer for outbound call');
      await setSdpAnswer(sdpAnswer);
    }
    
    // Resto do código existente...
  })
  .subscribe();
```

### 3. Expor `setSdpAnswer` no Hook

O hook `useWebRTCCall` já tem a função `setSdpAnswer`, mas ela não está sendo retornada.

**Arquivo**: `src/hooks/useWebRTCCall.ts`

**Modificação**: Adicionar `setSdpAnswer` no retorno:

```typescript
return {
  state,
  answerCall,
  rejectCall,
  hangup,
  initiateCall,
  toggleMute,
  cleanup,
  setSdpAnswer, // ADICIONAR
};
```

### 4. Conectar tudo no CallProvider

**Arquivo**: `src/providers/CallProvider.tsx`

**Modificação**: Incluir `setSdpAnswer` na desestruturação do hook:

```typescript
const {
  state: callState,
  answerCall,
  rejectCall,
  hangup,
  initiateCall: initiate,
  toggleMute,
  cleanup,
  setSdpAnswer, // ADICIONAR
} = useWebRTCCall();
```

## Fluxo Corrigido

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                       CHAMADA OUTBOUND (CORRIGIDA)                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. Frontend gera SDP Offer ─────────► cloudapi-initiate-call           │
│                                                │                        │
│  2. Meta responde com call_id ◄────────────────┘                        │
│                                                                         │
│  3. Cliente aceita a chamada no WhatsApp                                │
│                                                │                        │
│  4. Meta envia webhook com SDP Answer ─────────► cloudapi-webhook       │
│                                                │                        │
│  5. Webhook broadcasta via Realtime ───────────┼──► call_state_changed  │
│     com sdpAnswer incluído                     │                        │
│                                                ▼                        │
│  6. CallProvider recebe e chama ───────────────► setSdpAnswer()         │
│                                                │                        │
│  7. RTCPeerConnection.setRemoteDescription ────┘                        │
│                                                │                        │
│  8. ontrack dispara com remoteStream ──────────► ActiveCallOverlay      │
│                                                │                        │
│  9. <audio> recebe stream ─────────────────────► ÁUDIO FUNCIONA!        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Arquivos a Modificar

| # | Arquivo | Modificação |
|---|---------|-------------|
| 1 | `supabase/functions/cloudapi-webhook/index.ts` | Incluir `sdpAnswer` e `sdpType` no broadcast de `call_state_changed` para chamadas outbound aceitas |
| 2 | `src/hooks/useWebRTCCall.ts` | Adicionar `setSdpAnswer` no objeto de retorno |
| 3 | `src/providers/CallProvider.tsx` | Desestruturar `setSdpAnswer` do hook e chamar quando receber SDP via Realtime |

## Considerações Técnicas

- **Timing**: O webhook pode chegar antes do frontend estar pronto para receber. O Realtime do Supabase deve lidar com isso se a subscription já estiver ativa.
- **ICE Candidates**: Se houver ICE trickling, pode ser necessário implementar troca adicional de ICE candidates via Realtime.
- **Logs de Debug**: Manter logs detalhados para diagnosticar futuros problemas.

