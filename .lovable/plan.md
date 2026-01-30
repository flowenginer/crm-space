
### O que sabemos pelos seus logs e pelo código atual

1) **O CRM está chamando o endpoint certo da Meta**  
   - Edge Function: `supabase/functions/cloudapi-initiate-call/index.ts`  
   - Request: `POST https://graph.facebook.com/{apiVersion}/{phone_number_id}/calls` com `action:"connect"` e `session.sdp`  
   - Nos logs aparece claramente qual `phone_number_id` está sendo usado:
     - `phone_number_id`: **972828205910071**
     - `config.id`: **b1e4cc2d-ea09-44f5-a494-48a6d713378b**
     - `waba_id`: **861391676804044**

2) **A Meta está respondendo com erro oficial de “Calling API not enabled”**  
   - `code: 138000`, `subcode: 2593051`  
   - Mensagem: “WhatsApp Cloud API Calling not enabled for this phone number.”

Isso significa: **para a Meta, esse phone_number_id ainda não está habilitado/eligível para Calling API (especialmente chamadas iniciadas pela empresa)** — mesmo que no painel pareça “ativo”.

---

### Onde provavelmente está o desalinhamento (ponto importante)

Hoje existe um “painel de diagnóstico” no CRM (Configurações → Integrações → Cloud API → API de Ligações), porém:

- A Edge Function **`cloudapi-check-calling-status` está interpretando a resposta de `/settings` no formato errado**.  
  Ela tenta ler `settingsData.data[]` e procurar `setting_type === "calling"`.  
  Só que na documentação da Meta a resposta é no formato:
  ```json
  { "calling": { "status": "ENABLED" | "DISABLED", ... } }
  ```
  Resultado: **o CRM pode estar sempre dizendo “não habilitada” (falso negativo)** e vocês ficam sem um diagnóstico confiável dentro do próprio sistema.

Além disso:
- `cloudapi-check-calling-status` e `cloudapi-enable-calling` ainda usam um CORS mais restrito do que `cloudapi-initiate-call`. Em alguns browsers isso pode bloquear chamadas pelo frontend (preflight).

Ou seja: hoje vocês podem estar “fazendo tudo certo no Meta”, mas **o CRM não consegue confirmar com precisão o status real via Graph API** e também não está trazendo evidências suficientes (tier/health/status) para cravar o motivo do 138000.

---

### Objetivo do ajuste
1) Transformar o erro 138000 em um **diagnóstico verificável** (mostrando o status real de calling/settings + tier + health).  
2) Garantir que o CRM e a Meta estão “falando sobre o mesmo número” (o `phone_number_id` correto).  
3) Se estiver tudo habilitado mesmo, retornar evidências que apontem para **restrição de elegibilidade** (Tier/Business Verification/allowlist/BIC).

---

## Plano de correção (passo a passo)

### Fase 1 — Corrigir o diagnóstico para bater com a documentação da Meta
1. **Ajustar `supabase/functions/cloudapi-check-calling-status/index.ts`**
   - Atualizar o parse do endpoint:
     - `GET /{phone_number_id}/settings` → ler `settingsData.calling?.status`
   - Incluir no retorno (para UI e logs):
     - `calling_status` (ENABLED/DISABLED/unknown)
     - `callback_permission_status` (se disponível)
     - `call_icon_visibility` (se disponível)
   - Melhorar a parte de elegibilidade:
     - continuar retornando `messaging_limit_tier` e `tier_number`
     - adicionar `health_status` (via `GET /{phone_number_id}?fields=health_status,messaging_limit_tier,...`) para identificar bloqueios específicos
   - **Atualizar CORS headers** para aceitar os headers que o Supabase injeta (`x-supabase-client-*`), como já foi feito no `cloudapi-initiate-call`.

2. **Ajustar `supabase/functions/cloudapi-enable-calling/index.ts`**
   - Manter o `POST /{phone_number_id}/settings` com `calling.status="ENABLED"`.
   - Após habilitar, fazer um `GET /settings` e devolver o status real (`calling.status`) para o frontend.
   - Atualizar CORS headers igual acima.

3. **Opcional (recomendado): “mínimo v22.0” para endpoints de calling**
   - Hoje seu config está em `api_version: v21.0`.
   - A documentação e exemplos de calling usam `v22.0`.  
   - Implementar fallback: se `api_version` < `v22.0`, usar `v22.0` apenas para chamadas/calling settings.

---

### Fase 2 — Mostrar evidência no frontend (para vocês saberem exatamente “onde está errando”)
4. **Atualizar `src/components/settings/integrations/forms/CloudAPIConfigForm.tsx`**
   - Exibir um bloco “Diagnóstico Meta” quando `calling_enabled` estiver ligado, mostrando:
     - `Phone Number ID` (já mostra)
     - `display_phone_number`, `verified_name`
     - `messaging_limit_tier` / `tier_number` (com destaque se < 2)
     - `calling_status` (ENABLED/DISABLED)
     - `health_status` (se vier como BLOCKED/LIMITED)
   - Se `calling_status !== ENABLED`, mostrar CTA “Habilitar Calling API no Meta” (já existe), mas agora com resultado confiável.

5. **Atualizar `src/components/settings/integrations/forms/WebhookSetupGuide.tsx`**
   - Quando “API de Ligações” estiver ativa, instruir explicitamente a assinar também o campo:
     - `calls`
   - Hoje o guia lista só `messages` e `message_template_status_updates`, mas o backend suporta `calls` e isso é obrigatório para o fluxo de WebRTC (SDP answer via webhook).

---

### Fase 3 — Diagnóstico automático no momento de iniciar a chamada (para acabar com “achismo”)
6. **Atualizar `supabase/functions/cloudapi-initiate-call/index.ts`**
   - Antes de chamar `/calls`, fazer um precheck:
     - `GET /{phone_number_id}/settings` e `GET /{phone_number_id}?fields=messaging_limit_tier,health_status,...`
   - Se `calling.status !== ENABLED`, retornar 400 com:
     - `error: "Calling desabilitado no Meta para este phone_number_id"`
     - `details` contendo `calling.status`, `messaging_limit_tier`, etc.
   - Se estiver ENABLED mas continuar voltando 138000, retornar 400 com:
     - evidências (tier, health_status, calling settings) para cravar que é **restrição de elegibilidade/allowlist** e não “configuração esquecida”.

---

## Como isso responde diretamente ao seu pedido (“onde estamos errando?”)

Após essas mudanças, vocês terão respostas objetivas dentro do CRM:

- “Calling status no Graph API = DISABLED” → então **não está habilitado de verdade** no recurso do phone number (mesmo que UI do Meta pareça ativa).
- “Calling status = ENABLED, mas tier_number = 1” → **não elegível para Business-Initiated Calls**, então `/calls` pode continuar dando 138000.
- “Calling status = ENABLED, tier >= 2, health_status mostra bloqueio/limitação” → caso de **restrição/allowlist** e aí é Meta Support.
- “Tudo ok (ENABLED + Tier2+), mas ainda 138000” → forte indício de:
  - token/app sem acesso correto ao feature de calling para BIC, ou
  - requisito adicional não cumprido (ex.: BIC gating), e o CRM exibirá os campos para comprovar.

---

## Checklist de validação (após implementar)
1. Ir em **Configurações → Integrações → Cloud API → API de Ligações** e confirmar:
   - `calling_status` aparece e faz sentido.
   - `tier_number` aparece.
2. Assinar o campo **`calls`** no webhook da Meta e confirmar que o webhook continua recebendo (o backend já processa).
3. Testar iniciar chamada em `/conversations?...`:
   - Se falhar, o toast deve mostrar **o motivo com evidência** (status/tier/health).

---

## Notas técnicas (para implementação)
- Arquivos principais a alterar:
  - `supabase/functions/cloudapi-check-calling-status/index.ts` (parse correto + health_status + CORS)
  - `supabase/functions/cloudapi-enable-calling/index.ts` (CORS + retorno pós-enable)
  - `supabase/functions/cloudapi-initiate-call/index.ts` (precheck + evidência no erro)
  - `src/components/settings/integrations/forms/CloudAPIConfigForm.tsx` (exibir diagnóstico)
  - `src/components/settings/integrations/forms/WebhookSetupGuide.tsx` (incluir `calls` quando calling ativo)
- Manter o `cloudapi-webhook` como está: ele já suporta `calls` e SDP.

