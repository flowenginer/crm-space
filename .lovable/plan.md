
## Objetivo
Fazer o áudio das ligações WebRTC (WhatsApp Cloud API Calling) funcionar de forma confiável, cobrindo:
1) permissão de microfone no Chrome,
2) chegada do SDP Answer via webhook,
3) entrega do SDP Answer ao frontend via Supabase Realtime,
4) reprodução do `remoteStream` no navegador (e fallback caso o autoplay seja bloqueado).

---

## O que eu já consegui inferir pelos dados do seu projeto (causas mais prováveis)

### 1) O webhook **está recebendo o SDP Answer**
Na tabela `cloudapi_webhook_logs` (event_type = `calls`) existe evento com:
- `direction: BUSINESS_INITIATED`
- `event: connect`
- `session.sdp_type: answer`
- `session.sdp: ... (SDP completo)`

Ou seja: o Meta está mandando o “SDP answer” corretamente.

### 2) O frontend provavelmente **não está recebendo** os broadcasts do webhook
No backend (`cloudapi-webhook`) o broadcast é feito no canal:
- `supabase.channel('call-events').send(...)`
e `incoming-calls` para chamadas recebidas.

Mas no frontend (`CallProvider`) você está inscrito em canais com nomes diferentes:
- `supabase.channel('call-events-listener')`
- `supabase.channel('incoming-calls-listener')`

No Realtime do Supabase, broadcast é por “topic/canal”. Se o canal não for o mesmo, o listener não recebe. Isso por si só explica:
- `setSdpAnswer()` não ser chamado (logo `remoteStream` pode nunca aparecer)
- e também explicaria eventuais “incoming_call” não aparecerem.

### 3) O seu backend está comparando strings em minúsculas, mas o webhook manda em MAIÚSCULAS
Seu `processCalls` comenta/assume:
- `direction === 'business_initiated'`
- `status === 'accepted'`

Mas nos logs reais do webhook:
- `direction: BUSINESS_INITIATED` (maiúsculo)
- status e “event” parecem vir como `COMPLETED` e `connect/terminate`, nem sempre “accepted”.

Isso pode impedir o `includeSdp` de disparar mesmo que o SDP exista.

### 4) Mesmo com `remoteStream`, o Chrome pode bloquear o `audioEl.play()` se ocorrer “tarde demais”
Você já tem `<audio autoPlay playsInline />` e chama `audioEl.play()` dentro de `useEffect`.
Em alguns cenários o Chrome entende que não foi uma ação direta do usuário e bloqueia (NotAllowedError). Precisamos ter fallback com um botão “Ativar áudio”.

---

## Plano de correção (implementação)

### Etapa A — Ajustar os canais do Supabase Realtime (frontend) para bater com o backend
**Arquivo:** `src/providers/CallProvider.tsx`

1) Trocar:
- `supabase.channel('incoming-calls-listener')` → `supabase.channel('incoming-calls')`
- `supabase.channel('call-events-listener')` → `supabase.channel('call-events')`

2) Tornar o handler de `call_state_changed` mais resiliente:
- Aceitar `callId` OU `call_id` (porque `cloudapi-call-action` atualmente publica `call_id`).
- Logar explicitamente quando chegou `sdpAnswer` e qual callId casou.

**Resultado esperado:** o frontend finalmente recebe o `call_state_changed` com `sdpAnswer`, então consegue chamar `setSdpAnswer()`.

---

### Etapa B — Normalizar os campos do webhook e disparar SDP quando ele realmente chega (backend)
**Arquivo:** `supabase/functions/cloudapi-webhook/index.ts`

1) Normalizar:
- `directionNormalized = String(call.direction || '').toLowerCase()`
- `statusNormalized = String(call.status || '').toLowerCase()`
- `eventNormalized = String(call.event || '').toLowerCase()`
- `sdpTypeNormalized = String(call.session?.sdp_type || '').toLowerCase()`

2) Ajustar critérios para “tem SDP Answer que interessa”:
- Em vez de `status === 'accepted' && direction === 'business_initiated'`,
usar algo como:
  - `directionNormalized === 'business_initiated'`
  - `sdpTypeNormalized === 'answer'`
  - `!!session?.sdp`
  - e opcionalmente `eventNormalized === 'connect'` (ou “status” equivalente se existir)

3) Atualizar a lógica de broadcast para incluir `sdpAnswer` quando:
- vier `event=connect` com `session.sdp_type=answer`
- (e manter broadcast para outros estados como terminated/completed etc)

4) (Opcional, mas recomendado) Padronizar no payload broadcast:
- sempre enviar `callId` (camelCase) no broadcast do webhook (hoje já envia)
- sempre enviar `status` em minúsculas (ex.: `accepted`, `terminated`, `completed`) para o frontend consumir de maneira consistente.

**Resultado esperado:** o webhook sempre vai mandar `sdpAnswer` quando ele existir, independentemente de maiúsculas/minúsculas e da variação “status vs event”.

---

### Etapa C — Fallback de reprodução de áudio no Chrome (UI)
**Arquivo:** `src/components/calls/ActiveCallOverlay.tsx`

1) Detectar falha de autoplay:
- Quando `audioEl.play()` der erro (NotAllowedError), setar um estado local `needsUserAudioEnable=true`.

2) Mostrar um botão simples no overlay quando `needsUserAudioEnable` for true:
- Texto: “Ativar áudio”
- onClick: chama `audioEl.play()` novamente (agora com gesto do usuário)

3) Garantir que:
- `audioEl.muted = false`
- `audioEl.volume = 1`

**Resultado esperado:** mesmo se o Chrome bloquear autoplay, você consegue destravar com 1 clique.

---

### Etapa D — Diagnóstico de permissão de microfone (UX simples)
**Arquivo:** `src/hooks/useWebRTCCall.ts` (pequena melhoria)

1) Antes de chamar `getUserMedia`, tentar:
- `navigator.permissions.query({ name: 'microphone' as PermissionName })` (quando suportado)
- se vier “denied”, mostrar toast mais direto: “Microfone bloqueado no Chrome. Clique no cadeado ao lado da URL e permita.”

2) Logar detalhes do track local após `getUserMedia`:
- `enabled`, `muted`, `readyState`
- para diferenciar “tenho stream mas está mudo” vs “não tenho stream”.

---

## Passos de validação (checklist rápido de teste)
1) No Chrome, abrir o CRM e clicar no cadeado ao lado da URL → **Microfone = Permitir**.
2) Iniciar a chamada pelo CRM e atender no celular.
3) Conferir no console:
   - `[CallProvider] Call state changed:` deve aparecer
   - Deve aparecer log de SDP recebida: “Received SDP answer…”
   - Deve aparecer `[WebRTC] Setting SDP answer`
   - Deve aparecer `[WebRTC] Received remote track`
   - Deve aparecer `[ActiveCall] Connecting remote stream... tracks: 1`
4) Se aparecer erro de autoplay, clicar no botão “Ativar áudio”.

---

## Arquivos que serão alterados
- `src/providers/CallProvider.tsx` (trocar nomes de canais + aceitar call_id/callId + logs)
- `supabase/functions/cloudapi-webhook/index.ts` (normalização + lógica correta de incluir SDP answer)
- `src/components/calls/ActiveCallOverlay.tsx` (fallback de “Ativar áudio” se autoplay bloquear)
- (opcional) `src/hooks/useWebRTCCall.ts` (melhor diagnóstico de permissão e logs)

---

## Observação importante (para você testar agora, antes do código)
Mesmo sem mudar código: no Chrome, vá em:
- Chrome → Settings → Privacy and security → Site settings → Microphone
- Confirme que o domínio do seu app está como **Allowed**.
E na página do CRM:
- Clique no ícone do cadeado → Microphone → Allow → Reload.

---

## Próximas melhorias (depois que o áudio estiver OK)
- Mostrar um indicador “Webhook calls OK / último evento calls há X min” no card “Diagnóstico Meta”.
- Persistir no DB o `sdp_answer_received_at` no `call_logs` para troubleshooting.
- Implementar troca de ICE candidates se a Meta exigir em certos cenários de rede.
