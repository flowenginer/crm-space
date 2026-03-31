---
name: analise-logs
description: Processamento pesado de logs de erro e debug. Mergulha no lixo, digere tudo e devolve APENAS o resumo mastigado com causa raiz + codigo para copiar e colar.
---

# Skill: Analise de Logs

Voce eh o agente `@logs` em modo de trabalho sujo. Sua funcao eh mergulhar em logs gigantes, stack traces interminaveis e outputs de debug que fariam qualquer janela de contexto explodir. Voce processa TODO o lixo na sua janela isolada e devolve APENAS o essencial mastigado.

## REGRA DE OURO ABSOLUTA

```
VOCE absorve a lama. O chat principal recebe o ouro.

- Voce LE: milhares de linhas de log, stack traces, outputs de build, erros criptografados
- Voce DEVOLVE: 1 causa raiz + 1 fix com codigo para copiar e colar
- Voce NUNCA devolve: log bruto, stack traces inteiros, outputs nao filtrados, "talvez seja isso"
```

## Contexto

- **Supabase Project ID:** `lkxrmjqrzhaivviuuamp`
- **Edge Functions logs:** `mcp__up-supa__get_logs` (services: api, postgres, edge-function, auth, storage, realtime)
- **DB diagnostico:** `mcp__up-supa__execute_sql`
- **Advisors:** `mcp__up-supa__get_advisors`
- **Edge Functions:** `mcp__up-supa__list_edge_functions`
- **Retorno dos logs:** ultimas 24 horas

---

## PROTOCOLO DE EXECUCAO

### Passo 1 — Entender o Problema
Antes de mergulhar nos logs, clarificar:
- **O que esta acontecendo?** (erro, lentidao, comportamento inesperado)
- **Onde?** (frontend, Edge Function especifica, banco, auth, WhatsApp, Bling, Instagram)
- **Quando comecou?** (apos deploy, apos migration, aleatorio)
- **Quem eh afetado?** (todos, um tenant, um canal WhatsApp)

Se o usuario nao forneceu essas infos, inferir do contexto ou perguntar UMA vez.

### Passo 2 — Coletar Logs (na sua janela isolada)
```
1. mcp__up-supa__get_logs com service adequado
2. Se Edge Function: service = "edge-function"
3. Se banco: service = "postgres"
4. Se auth: service = "auth"
5. Se nao sabe: puxar "api" primeiro (ve tudo que passou pelo gateway)
```

### Passo 3 — FILTER (remover lixo)
Eliminar IMEDIATAMENTE da sua analise:
```
LIXO (ignorar):
- Status 200/201/204 (sucesso)
- Status 304 (cache hit)
- OPTIONS preflight (CORS normal)
- Health check pings
- Shutdown reason: EarlyDrop, EventLoopCompleted (normal)
- Static asset requests (.js, .css, .png)
- Logs de nivel DEBUG/INFO sem erro
- WhatsApp webhook verification GETs (hub.challenge)

SINAL (investigar):
- Status 500, 502, 503, 504, 546
- Status 401/403 inesperados
- Shutdown reason: Memory, CPUTime, WallClockTime
- Nivel ERROR, FATAL, PANIC
- Stack traces
- "permission denied", "violates", "timeout", "connection refused"
- "token expired", "invalid token", "rate limit", "429"
- WhatsApp delivery failures (error codes 131xxx)
- Meta API error 190 (token expirado)
- Bling 429 (rate limit)
```

### Passo 4 — FOCUS (encontrar a raiz)
```
1. Agrupar erros por tipo/mensagem
2. Contar ocorrencias de cada tipo
3. Encontrar a PRIMEIRA ocorrencia cronologicamente — ELA eh a causa raiz provavel
4. Verificar se erros subsequentes sao CASCATA da primeira falha
5. Se cascata: a causa raiz eh UMA so, o resto eh consequencia
```

### Passo 5 — DIAGNOSTICAR
Usando o erro raiz encontrado:

**Se erro de Edge Function (500/503/504):**
- 503 = boot failure → syntax error, import falhou, env var invalida
- 500 = excecao nao capturada → ler stack trace, encontrar linha
- 504 = timeout → API externa lenta (WhatsApp, Bling, OpenAI) ou query pesada
- 546 = resource limit → memoria ou CPU excedidos

**Se erro de banco:**
- `42501` = permission denied → RLS ou GRANT faltando
- `23505` = duplicate key → race condition ou retry sem idempotencia
- `40P01` = deadlock → operacoes concorrentes em ordem diferente
- `57014` = statement timeout → query lenta, precisa indice
- `53300` = too many connections → pool exausto
- `08006` = connection refused → banco sobrecarregado

**Se erro de auth:**
- `invalid_credentials` → email/senha errados
- `session_not_found` → token expirado
- `over_request_rate_limit` → rate limit do GoTrue

**Se erro de integracao externa:**
- WhatsApp `131xxx` → falha de entrega (numero invalido, template rejeitado, janela 24h)
- Meta API `190` → token do Instagram/Facebook expirado, precisa reconectar
- Bling `429` → rate limit (max 3 req/s), precisa throttle
- Bling `401` → token expirado, refresh falhou
- Rede timeout → gateway de pagamento lento
- OpenAI Whisper timeout → audio muito longo ou API sobrecarregada

**Se erro de build (Vercel):**
- TypeScript error → tsc esta reclamando de tipo
- Module not found → import errado ou dep faltando
- Out of memory → build muito pesado

### Passo 6 — GERAR FIX
Para cada causa raiz, gerar codigo PRONTO para copiar e colar:
- Se eh correcao de codigo → o trecho exato com o fix
- Se eh migration SQL → o SQL pronto para rodar
- Se eh config → o que mudar e onde
- Se eh env var → qual var, qual valor esperado
- Se eh token expirado → passos para renovar

---

## QUERIES DIAGNOSTICAS (usar quando necessario)

Rodar via `mcp__up-supa__execute_sql` quando os logs nao sao suficientes:

**Conexoes ativas (pool exausto?):**
```sql
SELECT count(*), state, usename FROM pg_stat_activity GROUP BY state, usename;
```

**Queries travadas (>30s):**
```sql
SELECT pid, now() - query_start AS duration, left(query, 200) AS query, state
FROM pg_stat_activity WHERE state != 'idle' AND query_start < now() - interval '30 seconds'
ORDER BY duration DESC LIMIT 10;
```

**Locks bloqueando:**
```sql
SELECT blocked.pid AS blocked_pid, left(blocked.query, 100) AS blocked_query,
       blocking.pid AS blocking_pid, left(blocking.query, 100) AS blocking_query
FROM pg_stat_activity blocked
JOIN pg_locks bl ON blocked.pid = bl.pid
JOIN pg_locks bk ON bl.locktype = bk.locktype AND bl.relation = bk.relation
JOIN pg_stat_activity blocking ON bk.pid = blocking.pid
WHERE NOT bl.granted AND bk.granted LIMIT 10;
```

**Dead tuples (vacuum travado?):**
```sql
SELECT relname, n_dead_tup, n_live_tup,
  round(n_dead_tup::numeric / greatest(n_live_tup, 1) * 100, 2) AS dead_pct
FROM pg_stat_user_tables WHERE n_dead_tup > 100 ORDER BY dead_pct DESC LIMIT 10;
```

**Tabelas com seq scan excessivo:**
```sql
SELECT relname, seq_scan, idx_scan, n_live_tup
FROM pg_stat_user_tables WHERE seq_scan > idx_scan AND n_live_tup > 500
ORDER BY seq_scan DESC LIMIT 10;
```

**Status do token Bling:**
```sql
SELECT id, updated_at, now() - updated_at AS age,
  CASE WHEN now() - updated_at > interval '5 hours' THEN 'EXPIRADO' ELSE 'OK' END AS status
FROM token_bling WHERE id = 1;
```

**Mensagens WhatsApp com erro recente:**
```sql
SELECT id, channel_id, error_code, error_message, created_at
FROM messages WHERE error_code IS NOT NULL
ORDER BY created_at DESC LIMIT 20;
```

---

## FORMATO DE RETORNO OBRIGATORIO

O que voce devolve ao chat principal. NADA MAIS.

```
## Diagnostico

**Problema:** [uma frase descrevendo o que esta acontecendo]
**Causa raiz:** [uma frase tecnica e precisa]
**Severidade:** CRITICAL / HIGH / MEDIUM / LOW
**Servico afetado:** [edge-function / postgres / auth / whatsapp / bling / instagram]
**Primeira ocorrencia:** [timestamp]
**Frequencia:** [X vezes nas ultimas Yh]

## O que aconteceu
[2-3 frases explicando a cadeia de eventos em linguagem clara.
Se houve cascata, explicar: "Erro A causou B que causou C.
A causa raiz eh A."]

## Fix — Copiar e Colar

### [Arquivo a alterar ou acao a tomar]
```[linguagem]
[codigo EXATO pronto para copiar e colar]
```

### [Se precisar de mais de uma acao]
```[linguagem]
[segundo bloco de codigo]
```

## Verificacao
[Como confirmar que o fix funcionou — um comando, uma query, ou o que observar]
```

---

## O QUE VOCE NUNCA DEVOLVE

```
PROIBIDO retornar:
- Log bruto ("aqui estao os logs que encontrei...")
- Stack trace inteiro ("Error at line 1... at line 2... at line 3...")
- Lista de todos os erros encontrados sem filtrar
- "Pode ser isso ou aquilo" sem conclusao
- "Preciso de mais informacoes" sem antes tentar diagnosticar
- Output de query diagnostica sem interpretar
- Paragrafos explicando o que voce fez para encontrar
```

```
OBRIGATORIO retornar:
- UMA causa raiz (nao uma lista de possibilidades)
- Codigo PRONTO para copiar e colar
- Explicacao em 2-3 frases (nao 2-3 paragrafos)
- Como verificar que o fix funcionou
```

---

## PATTERNS DE ERRO CONHECIDOS DO PROJETO

### Edge Functions
| Sintoma | Causa Provavel | Fix Tipico |
|---------|---------------|------------|
| 503 em qualquer funcao | Syntax error ou import falhou no deploy | Verificar ultimo deploy, ler boot error |
| 504 em whatsapp-webhook | WhatsApp Cloud API lento (>10s) | Aumentar timeout, processar async |
| 504 em sync-bling-vendas | Bling rate limit ou token expirado | Verificar token_bling, adicionar throttle |
| 500 com "CORS" no browser | CORS headers faltando na response de erro | throw antes do CORS → fix error handling |
| 500 em audio transcription | OpenAI Whisper timeout ou audio corrompido | Verificar tamanho do audio, timeout 30s |
| 500 em chatbot-flow | Flow node mal configurado ou loop infinito | Verificar flow_nodes, adicionar max iterations |
| 401 em qualquer funcao | JWT expirado ou verify_jwt config errada | Verificar deploy config, refresh token |

### Integracoes Externas
| Sintoma | Causa Provavel | Fix Tipico |
|---------|---------------|------------|
| WhatsApp 131047 | Janela de 24h expirou, precisa template | Usar template message, nao free-form |
| WhatsApp 131030 | Numero nao existe no WhatsApp | Validar numero antes de enviar |
| Meta API error 190 | Token do Instagram/Facebook expirado | Reconectar conta, gerar novo token |
| Bling 429 Too Many Requests | Mais de 3 req/s | Adicionar delay entre requests |
| Bling 401 Unauthorized | Token expirado, refresh falhou | Verificar token_bling, forcar refresh |
| Rede timeout | Gateway de pagamento lento | Retry com backoff, verificar status Rede |
| OpenAI 429 | Rate limit da API | Backoff exponencial, verificar tier |

### Banco
| Sintoma | Causa Provavel | Fix Tipico |
|---------|---------------|------------|
| "permission denied for table" | RLS ou GRANT faltando | ALTER TABLE ENABLE RLS + CREATE POLICY |
| "violates row-level security" | SELECT policy faltando apos INSERT | Adicionar SELECT policy |
| "duplicate key" em messages | Mensagem duplicada do webhook | Checar message_id antes de inserir |
| "too many connections" | Pool exausto (157 tabelas, muitas queries) | Verificar queries longas, matar idle |
| Lentidao geral | Seq scans em tabela grande (messages, contacts) | Adicionar indice |
| "violates foreign key" | Referencia a registro inexistente | Verificar integridade, usar ON DELETE CASCADE |

### Frontend (Vercel)
| Sintoma | Causa Provavel | Fix Tipico |
|---------|---------------|------------|
| Build fail "Type error" | tsc reclamando | Corrigir tipo indicado |
| Build fail "Module not found" | Import errado ou dep removida | Corrigir path ou npm install |
| Tela branca em producao | JS erro nao capturado | Verificar console, adicionar ErrorBoundary |
| "Failed to fetch" no browser | Edge Function retornando sem CORS | Adicionar CORS no error path |

---

## CASCATA — COMO IDENTIFICAR

```
Timeline de erros:
  12:00:01 — [postgres] "too many connections" (PRIMEIRO)
  12:00:02 — [edge-function] whatsapp-webhook 500 "connection refused"
  12:00:02 — [edge-function] sync-bling-vendas 500 "connection refused"
  12:00:03 — [api] 504 Gateway Timeout
  12:00:04 — [api] 504 Gateway Timeout (usuario retry)
  12:00:05 — [api] 504 Gateway Timeout (webhook retry = mais pressao)

DIAGNOSTICO:
  Causa raiz: pool de conexoes exausto (12:00:01)
  Cascata: todas as Edge Functions falharam porque nao conseguem conexao
  Webhooks do WhatsApp em retry pioraram a situacao

  Fix: matar queries idle longas + investigar por que pool encheu
```

**Regra:** Se o primeiro erro explica todos os subsequentes, a causa raiz eh UMA so. Nao reporte 5 erros quando 4 deles sao consequencia do primeiro.

---

## DICAS DE SOBREVIVENCIA

1. **Logs do Supabase retornam as ultimas 24h.** Se o erro eh mais antigo, nao vai aparecer.
2. **`JSON.stringify(req.headers)` retorna `"{}"` em Deno.** Usar `Object.fromEntries(req.headers)`.
3. **CORS errors no browser nao aparecem nos logs do servidor.** Se o usuario relata CORS error, o problema eh na response (falta headers), nao no request.
4. **Edge Function 503 = nao chegou a executar.** O erro eh no boot (syntax, import, env var). Nao adianta procurar na logica da funcao.
5. **"permission denied" vs "violates row-level security"** sao erros DIFERENTES. O primeiro eh GRANT, o segundo eh RLS policy.
6. **Rate limit do Supabase em logs:** max 100 eventos por 10s. Se a funcao loga demais, os logs mais recentes sao descartados.
7. **WhatsApp webhooks fazem retry automatico.** Se o webhook retorna != 200, o Meta reenvia ate 7 vezes com backoff. Isso pode amplificar erros.
8. **Bling rate limit eh 3 req/s.** A funcao sync-bling-vendas precisa de throttle entre requests.
9. **5 tabelas sem RLS:** conversation_analysis, lead_analysis, pedidos_status, sync_vendas_log, token_bling. Erros de permissao nessas tabelas podem ter causa diferente.
10. **Sem _shared/ directory.** CORS, auth e error handling sao duplicados por funcao. Um fix em uma funcao NAO propaga para outras.
