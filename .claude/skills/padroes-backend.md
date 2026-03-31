---
name: padroes-backend
description: Playbook de convencoes estritas para APIs REST — rotas, seguranca, error handling padronizado, JSON limpo, documentacao de integracoes externas.
---

# Skill: Padroes de Backend

Voce eh o agente `@backend` executando com rigor este playbook. Toda Edge Function criada ou modificada DEVE seguir TODAS as regras abaixo. Nenhuma excecao.

## Contexto

- **Runtime:** Deno (Supabase Edge Functions)
- **Entry point:** `Deno.serve()` — NUNCA o pattern antigo `import { serve }`
- **Auth:** Supabase Auth (JWT via `supabase.auth.getUser()`), service_role fallback, custom API keys (`integration_api_keys`)
- **Banco:** PostgreSQL via Supabase client
- **Integracoes:** WhatsApp Cloud API (Meta Graph API v21.0), Bling ERP v3, Instagram Graph API, Rede (e.Rede API), OpenAI Whisper
- **SEM _shared/ directory** — CORS, auth e error handling duplicados por funcao
- **Project ID:** `lkxrmjqrzhaivviuuamp`
- **MCP:** mcp__flowenginer__* (GitHub), mcp__up-supa__* (Supabase)

### NOTA CRITICA: Sem _shared/

Este projeto NAO tem diretorio `_shared/`. Isso significa:
- CORS headers sao definidos em cada funcao individualmente
- Auth verification eh duplicada em cada funcao
- Error handling eh inconsistente entre funcoes
- Um fix em uma funcao NAO propaga para outras automaticamente
- Ao criar nova funcao, copiar patterns de funcoes existentes similares
- Ao corrigir um pattern (ex: CORS), verificar TODAS as funcoes afetadas

---

## 1. CONVENCOES DE API REST

### Estrutura de Rotas

Cada Edge Function eh um endpoint. Nomenclatura:
```
Verbo/Acao + Recurso:
  whatsapp-webhook       (POST — recebe eventos do WhatsApp)
  send-whatsapp          (POST — envia mensagem WhatsApp)
  sync-bling-vendas      (POST — sincroniza vendas do Bling)
  process-audio          (POST — transcreve audio via Whisper)
  chatbot-flow           (POST — executa fluxo do chatbot)
  manage-contacts        (POST — dispatcher de acoes de contatos)
  instagram-webhook      (POST — recebe eventos do Instagram)
  rede-webhook           (POST — recebe notificacoes de pagamento)
```

### Metodos HTTP — Quando Usar
| Metodo | Quando | Idempotente | Body |
|--------|--------|-------------|------|
| **GET** | Consultar recurso sem side effects | Sim | Nao |
| **POST** | Criar recurso ou executar acao | Nao* | Sim |
| **PUT** | Substituir recurso inteiro | Sim | Sim |
| **PATCH** | Atualizar campos especificos | Nao | Sim |
| **DELETE** | Remover recurso | Sim | Nao |

*POST com Idempotency-Key se torna idempotente.

### Status Codes — Uso Estrito
| Code | Quando Usar | Exemplo |
|------|-------------|--------|
| **200** | Sucesso com body de resposta | GET recurso, POST acao concluida |
| **201** | Recurso criado com sucesso | POST que cria entidade |
| **204** | Sucesso sem body | DELETE concluido |
| **400** | Sintaxe malformada | JSON invalido, Content-Type errado, body nao parseavel |
| **401** | Auth ausente ou invalido | JWT faltando, token expirado |
| **403** | Autenticado mas sem permissao | Role errado, tenant errado |
| **404** | Recurso nao existe | Contato, deal, flow nao encontrado |
| **409** | Conflito de estado | Unique key duplicada, versao conflitante |
| **422** | Semanticamente invalido | Telefone invalido, flow_id inexistente, regra de negocio falhou |
| **429** | Rate limit excedido | DEVE incluir header `Retry-After` |
| **500** | Erro interno nao esperado | Bug, config faltando |
| **502** | API upstream retornou erro | WhatsApp, Bling, Instagram, Rede com erro |
| **504** | API upstream timeout | WhatsApp, Bling, Instagram, Rede nao respondeu |

**PROIBIDO:** Usar 500 para erros do cliente. Usar 200 para erros. Retornar status codes genericos.

---

## 2. ESTRUTURA DE TODA EDGE FUNCTION

### Template Obrigatorio
```typescript
// SEM _shared/ — definir CORS e helpers inline ou copiar de funcao similar

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const LOG_PREFIX = "FUNCTION-NAME";

interface RequestBody {
  // Tipar TODOS os campos esperados — nunca `any`
  field_name: string;
  optional_field?: number;
}

Deno.serve(async (req) => {
  // 1. CORS preflight — SEMPRE primeiro
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log(`[${LOG_PREFIX}] Function started`);

    // 2. Autenticacao — SEMPRE (exceto webhooks)
    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader! } } }
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Nao autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    console.log(`[${LOG_PREFIX}] User authenticated: ${user.id}`);

    // 3. Buscar tenant_id do profile — NUNCA confiar no client
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: profile } = await adminClient
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();
    const tenantId = profile?.tenant_id;

    // 4. Validacao de input — SEMPRE, whitelist approach
    const body = await req.json() as RequestBody;
    // Validar campos...

    // 5. Logica de negocio
    const result = await processRequest(body, tenantId);

    // 6. Response padrao
    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error(`[${LOG_PREFIX}] ERROR:`, error instanceof Error ? error.message : String(error));
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

### Regras da Estrutura
1. **CORS preflight eh SEMPRE a primeira linha** — antes de auth, antes de tudo
2. **Auth vem logo depois** — nenhuma logica antes da verificacao de identidade
3. **tenant_id do profile, NUNCA do client** — buscar server-side sempre
4. **Validacao antes de processar** — rejeitar input ruim o mais cedo possivel
5. **Log em cada etapa critica** — facilita debug em producao
6. **Unico try/catch no topo** — erros propagam via throw, capturados uma vez
7. **CORS headers em TODA response** — sucesso, erro e OPTIONS

---

## 3. VALIDACAO DE INPUT — WHITELIST APPROACH

### Regras Estritas
- **Extrair APENAS campos esperados** — nunca passar `body` inteiro ao banco
- **Validar tipo de cada campo** — `typeof field !== 'string'` → rejeitar
- **Validar formato quando aplicavel** — telefone, email, UUID, datas
- **Rejeitar campos extras silenciosamente** — nao propagar ao banco
- **Retornar 400 para sintaxe, 422 para semantica**

### Pattern Obrigatorio
```typescript
function validateContactInput(body: unknown): { name: string; phone: string; tenant_id: string } {
  if (!body || typeof body !== "object") {
    throw new Error("Request body must be JSON");
  }

  const { name, phone } = body as Record<string, unknown>;

  if (typeof name !== "string" || name.trim().length === 0) {
    throw new Error("name is required");
  }

  if (typeof phone !== "string" || !isValidBrazilianPhone(phone)) {
    throw new Error("Telefone invalido");
  }

  // Retornar APENAS campos validados — whitelist
  return { name: name.trim(), phone: normalizeBrazilianPhone(phone) };
}
```

### Normalizacao de Telefone Brasileiro
```typescript
function normalizeBrazilianPhone(phone: string): string {
  // Remove tudo que nao eh digito
  const digits = phone.replace(/\D/g, "");
  // Remove 55 do inicio se presente
  const withoutCountry = digits.startsWith("55") ? digits.slice(2) : digits;
  // Garante formato DDnumero (11 digitos com 9)
  if (withoutCountry.length === 10) {
    // Adiciona 9 apos DDD
    return `55${withoutCountry.slice(0, 2)}9${withoutCountry.slice(2)}`;
  }
  if (withoutCountry.length === 11) {
    return `55${withoutCountry}`;
  }
  return `55${withoutCountry}`;
}
```

### PROIBIDO
```typescript
// NUNCA passar body direto ao banco
await supabase.from('contacts').update(body).eq('id', contactId);
// Atacante envia: { tenant_id: 'outro-tenant', role: 'admin' }

// CORRETO — allowlist explicita
const { name, phone, email } = validateContactUpdate(body);
await supabase.from('contacts').update({ name, phone, email }).eq('id', contactId).eq('tenant_id', tenantId);
```

---

## 4. SEGURANCA DE ROTAS

### Auth Obrigatoria
- **TODO endpoint que le/escreve dados de usuario DEVE verificar auth via JWT**
- **Desabilitar JWT verification APENAS para:** webhooks (whatsapp-webhook, instagram-webhook, rede-webhook), endpoints com API key customizada

### Webhook Authentication
Cada webhook tem seu proprio mecanismo:
```typescript
// WhatsApp — verify_token no GET (subscription verification)
if (req.method === "GET") {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

// Instagram — mesmo pattern do WhatsApp (Meta Graph API)
// Rede — SEM validacao de assinatura (FLAG: vulnerabilidade conhecida)
// Bling — verificar via API key ou token customizado
```

**FLAG DE SEGURANCA:** O webhook da Rede NAO valida assinatura. Qualquer um pode enviar payloads falsos. Isso deve ser corrigido.

### API Key Authentication (integration_api_keys)
```typescript
// Para integracao externa via API key customizada
const apiKey = req.headers.get("x-api-key");
const { data: keyRecord } = await adminClient
  .from("integration_api_keys")
  .select("tenant_id, is_active")
  .eq("api_key", apiKey)
  .eq("is_active", true)
  .single();
if (!keyRecord) {
  return new Response(JSON.stringify({ error: "API key invalida" }), { status: 401 });
}
const tenantId = keyRecord.tenant_id;
```

### Tenant Isolation
- **TODA query que acessa dados de usuario DEVE filtrar por tenant_id**
- **Nunca confiar em tenant_id vindo do client** — buscar do profile server-side:
```typescript
const { data: profile } = await adminClient
  .from("profiles")
  .select("tenant_id")
  .eq("id", user.id)
  .single();
// Usar profile.tenant_id — NUNCA body.tenant_id
```

### Queries Seguras
- **SEMPRE usar Supabase client parametrizado** (`.eq()`, `.in()`, etc.)
- **NUNCA string concatenation em queries**
- **NUNCA `select("*")`** — especificar colunas
- **NUNCA passar IDs do client sem verificar ownership + tenant_id**

### Secrets
- Acessar via `Deno.env.get("SECRET_NAME")`
- **NUNCA logar secrets** — truncar para debug
- **NUNCA hardcoded** — usar env vars
- Validar env vars obrigatorias no startup — fail fast

---

## 5. ERROR HANDLING PADRONIZADO

### Como Tratar Erros (sem _shared/errors.ts)
Como nao existe classe AppError compartilhada, usar pattern consistente:

```typescript
// Definir inline em cada funcao ou extrair para helper local
function errorResponse(message: string, status: number, code: string) {
  return new Response(
    JSON.stringify({ error: message, code }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// Input invalido (400)
return errorResponse("campo obrigatorio ausente", 400, "MISSING_FIELD");

// Validacao semantica (422)
return errorResponse("Telefone invalido", 422, "INVALID_PHONE");

// Nao encontrado (404)
return errorResponse("Contato nao encontrado", 404, "NOT_FOUND");

// Sem permissao (403)
return errorResponse("Sem permissao para este tenant", 403, "FORBIDDEN");

// Erro externo (502)
return errorResponse(`WhatsApp API: ${errorBody}`, 502, "WHATSAPP_API_ERROR");

// Timeout externo (504)
return errorResponse("Bling timeout", 504, "BLING_TIMEOUT");
```

### Taxonomia de Codigos de Erro
```
AUTH_*          : UNAUTHORIZED, FORBIDDEN, TOKEN_EXPIRED
VALIDATION_*   : MISSING_FIELD, INVALID_FORMAT, INVALID_PHONE
RESOURCE_*     : NOT_FOUND, CONFLICT, ALREADY_EXISTS
EXTERNAL_*     : WHATSAPP_API_ERROR, BLING_API_ERROR, INSTAGRAM_API_ERROR, REDE_API_ERROR, OPENAI_API_ERROR
EXTERNAL_*     : WHATSAPP_TIMEOUT, BLING_TIMEOUT, INSTAGRAM_TIMEOUT, REDE_TIMEOUT, OPENAI_TIMEOUT
INTERNAL_*     : INTERNAL_ERROR, CONFIG_ERROR, DB_ERROR
BUSINESS_*     : WINDOW_EXPIRED, TEMPLATE_REJECTED, RATE_LIMITED, FLOW_ERROR
```

### PROIBIDO
```typescript
// NUNCA catch vazio
catch (e) {} // PROIBIDO

// NUNCA silenciar erro critico
catch (e) { console.log(e); } // PROIBIDO sem re-throw ou tratamento

// NUNCA retornar 500 para erro do cliente
return new Response("Error", { status: 500 }); // PROIBIDO se eh 400/422

// NUNCA expor detalhes internos ao cliente
return new Response(JSON.stringify({ error: error.stack }), { status: 500 }); // PROIBIDO
```

---

## 6. FORMATO DE SAIDA — JSON LIMPO

### Response de Sucesso
```json
{
  "message_id": "wamid.xxx",
  "status": "sent"
}
```
Ou para listas:
```json
{
  "data": [{ "id": "...", "name": "..." }],
  "cursor": "abc123",
  "has_more": true
}
```

**Regras:**
- Campos em `snake_case` (consistente com banco)
- Sem campos nulos desnecessarios — omitir se vazio
- Sem metadata interna (tenant_id, service_role) em respostas ao cliente final
- Datas em ISO 8601: `"2026-03-30T12:00:00.000Z"`
- Valores monetarios como numero (nao string): `29.90`
- Telefones no formato internacional: `"5521998503419"`

### Response de Erro
```json
{
  "error": "Janela de 24 horas expirou. Use um template aprovado.",
  "code": "WINDOW_EXPIRED"
}
```

**Regras:**
- `error` = mensagem legivel para o usuario (em portugues quando possivel)
- `code` = identificador maquina para tratamento no frontend
- **NUNCA** incluir stack trace, nomes de tabelas, SQL, ou paths de arquivo
- **NUNCA** retornar o objeto de erro bruto do Supabase/WhatsApp/Bling ao cliente

### CORS em TODA Response
```typescript
// TODA response — sucesso, erro, e OPTIONS — DEVE ter CORS headers
// Como nao ha _shared/, DEFINIR corsHeaders no topo de cada funcao
// NUNCA retornar Response sem headers CORS — browser bloqueia silenciosamente
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
```

---

## 7. INTEGRACOES EXTERNAS — DOCUMENTACAO OBRIGATORIA

### Regra Principal
Toda API externa integrada DEVE ter seus argumentos e expectativas de tipo documentados no codigo e na doc.

### Template de Documentacao (no codigo)
```typescript
/**
 * Envia mensagem de texto via WhatsApp Cloud API.
 *
 * @endpoint POST /{phone_id}/messages
 * @auth Bearer access_token
 * @timeout 10s
 * @docs https://developers.facebook.com/docs/whatsapp/cloud-api/messages/text-messages
 *
 * @param phoneNumberId - ID do numero registrado no Meta Business
 * @param to - Numero destino formato internacional (5521998503419)
 * @param text - Texto da mensagem (max 4096 chars)
 *
 * @returns { messages: [{ id: string }] }
 * @throws WHATSAPP_API_ERROR (502) — erro na API do WhatsApp
 * @throws WHATSAPP_TIMEOUT (504) — WhatsApp nao respondeu em 10s
 */
```

### Timeout Obrigatorio
```typescript
// TODA chamada externa DEVE ter timeout via AbortSignal
const response = await fetch(url, {
  ...options,
  signal: AbortSignal.timeout(10_000), // 10s
});
```

**Timeouts recomendados:**
| Servico | Timeout | Rate Limit |
|---------|---------|------------|
| WhatsApp Cloud API | 10s | 80 msg/s por numero |
| Bling ERP v3 | 10s | 3 req/s |
| Instagram Graph API | 10s | Varia por endpoint |
| Rede (e.Rede API) | 10s | Sem limite documentado |
| OpenAI Whisper | 30s | Varia por tier |
| Meta Graph API (geral) | 10s | Varia por endpoint |

### Mapeamento de Erros Externos
```typescript
// NUNCA propagar status code do upstream diretamente ao cliente
// WhatsApp retorna 401 → nosso cliente recebe 502 (EXTERNAL_SERVICE_ERROR)
// Bling retorna 429 → nosso cliente recebe 503 + Retry-After (EXTERNAL_RATE_LIMIT)
// Instagram retorna 190 → nosso cliente recebe 502 (TOKEN_EXPIRED)
// Rede retorna 5xx → nosso cliente recebe 502 (EXTERNAL_SERVICE_ERROR)
// Qualquer timeout → nosso cliente recebe 504 (EXTERNAL_TIMEOUT)
```

### Retry Strategy
```typescript
// Retries APENAS para erros transientes (502, 503, 504, 429)
// NUNCA retry em 400, 401, 403, 404, 422 — sao erros definitivos
// Exponential backoff com jitter: base * 2^attempt + random(0-1s)
// Max 3 retries
// ATENCAO: Bling tem rate limit de 3 req/s — respeitar com delay entre requests
```

---

## 8. LOGGING PADRONIZADO

### Pattern (sem logStep compartilhado)
```typescript
// Definir LOG_PREFIX no topo de cada funcao
const LOG_PREFIX = "WHATSAPP-WEBHOOK";

// Usar console.log/console.error com prefixo
console.log(`[${LOG_PREFIX}] Step description`, JSON.stringify({ key: "value" }));
console.error(`[${LOG_PREFIX}] ERROR:`, error.message);
```

### O que Logar
```
SEMPRE: inicio da funcao, auth concluido, input validado, resultado principal, erro
QUANDO RELEVANTE: duracao de chamadas externas, IDs criados, status de operacoes
```

### O que NUNCA Logar
```
NUNCA: tokens JWT completos, API keys, access_tokens do WhatsApp/Instagram
NUNCA: conteudo de mensagens do WhatsApp (privacidade)
NUNCA: CPF/CNPJ completo (mascarar: "***.***.***-09")
NUNCA: email completo em logs de debug (truncar: "mat***@gmail.com")
NUNCA: body completo do request (pode conter dados sensiveis)
```

---

## 9. WEBHOOKS

### Regras Estritas
1. **Verificar autenticidade PRIMEIRO** — verify_token (WhatsApp/Instagram), API key (Bling), NENHUMA (Rede - FLAG)
2. **Checar idempotencia** — message_id ou event_id ja processado? Pular
3. **Retornar 200 RAPIDO** — processar em background se necessario
4. **Gravar no banco ANTES de side effects** — message primeiro, depois processar chatbot
5. **Nunca confiar no payload cegamente** — validar campos criticos
6. **Logar metadata do evento** — tipo, timestamp, IDs (sem conteudo sensivel)

### WhatsApp Webhook Template
```typescript
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // GET = subscription verification
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token === Deno.env.get("WA_VERIFY_TOKEN")) {
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  // POST = incoming event
  try {
    const payload = await req.json();
    const entry = payload.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    // Mensagem recebida
    if (value?.messages?.[0]) {
      const message = value.messages[0];
      const from = message.from; // numero do remetente
      const messageId = message.id;

      // Idempotencia — checar se ja processamos
      const { data: existing } = await adminClient
        .from("messages")
        .select("id")
        .eq("whatsapp_message_id", messageId)
        .maybeSingle();
      if (existing) {
        return new Response(JSON.stringify({ status: "already_processed" }), { status: 200 });
      }

      // Gravar mensagem PRIMEIRO
      await adminClient.from("messages").insert({ ... });

      // Processar chatbot/automacoes DEPOIS
      // ...
    }

    return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
  } catch (error) {
    console.error("[WHATSAPP-WEBHOOK] ERROR:", error.message);
    // SEMPRE retornar 200 para webhooks — evitar retries do Meta
    return new Response(JSON.stringify({ status: "error" }), { status: 200 });
  }
});
```

---

## 10. ANTI-PATTERNS PROIBIDOS

| Anti-Pattern | Correto |
|---|---|
| Body inteiro passado ao banco (mass assignment) | Allowlist explicita de campos |
| catch vazio `catch (e) {}` | Sempre logar, re-throw, ou tratar |
| `select("*")` | Especificar colunas |
| Fetch sem timeout | `AbortSignal.timeout()` obrigatorio |
| Status 500 para erro do cliente | 400/422 para input, 401/403 para auth |
| Secret hardcoded ou logado | `Deno.env.get()` + nunca logar |
| tenant_id do client trusted | Buscar do profile server-side |
| Response sem CORS | Definir corsHeaders em TODA funcao |
| Erro upstream propagado direto | Mapear para codigo interno (502/503/504) |
| Webhook sem idempotencia | Checar message_id/event_id antes de processar |
| console.log solto sem prefixo | `[LOG_PREFIX]` estruturado |
| Rede webhook sem validacao | FLAG — precisa implementar signature validation |
| Bling requests sem throttle | Respeitar 3 req/s com delay |
| Telefone sem normalizar | Usar normalizeBrazilianPhone() |

---

## FORMATO DE ENTREGA OBRIGATORIO

Toda Edge Function criada ou modificada por esta skill DEVE incluir:

```
## Edge Function: [nome-da-funcao]

### Endpoint
- Metodo: [POST/GET]
- Auth: [JWT obrigatorio / API key / webhook verify_token / publico]
- Rate limit: [se aplicavel]

### Request
| Campo | Tipo | Obrigatorio | Validacao |
|-------|------|-------------|----------|
| field | string | Sim | min 1 char, max 100 |

### Response (sucesso)
```json
{ "field": "value" }
```

### Response (erros)
| Status | Code | Quando |
|--------|------|--------|
| 400 | MISSING_FIELD | campo obrigatorio ausente |
| 422 | INVALID_FORMAT | formato invalido |

### Integracoes Externas Usadas
| Servico | Endpoint | Timeout | Retry |
|---------|----------|---------|-------|
| WhatsApp | POST /{phone_id}/messages | 10s | 3x backoff |

### Codigo
[codigo completo]

### Checklist
- [x] CORS preflight tratado
- [x] Auth verificado (JWT / API key / verify_token)
- [x] Input validado (whitelist)
- [x] Queries com colunas especificas
- [x] Queries filtram por tenant_id
- [x] Timeouts em chamadas externas
- [x] Status codes corretos
- [x] Erros estruturados com code
- [x] Log com prefixo em cada etapa
- [x] Sem secrets logados
- [x] JSON response limpo
- [x] Telefones normalizados
```
```
