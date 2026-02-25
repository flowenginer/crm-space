# PLANO DE ACAO - Modulo de Conversas | Space Sports CRM

**Versao:** 1.0
**Data:** 25/02/2026
**Baseado em:** PRD-CONVERSAS.md + Auditoria Tecnica do Codebase

---

## RESUMO EXECUTIVO

Apos analise completa do codebase (70+ tabelas, 35+ componentes, 25+ hooks), foram identificados **14 gaps criticos**, **bugs em producao**, e **funcionalidades incompletas**. Este plano organiza as acoes em 4 fases com prioridades claras.

---

## FASE 1 — CRITICO (Semana 1-2) | Bugs e Riscos em Producao

> Correcoes que impactam diretamente usuarios em producao AGORA.

### 1.1 Remover 66 console.log de debug em producao
- **Arquivo:** `src/pages/Conversations.tsx`
- **Problema:** 66 statements de `console.log('[DEBUG]...')` disparam a cada render, expostos ao console do usuario
- **Linhas criticas:** 1399-1402, 1412-1415, 2763-2765, 2816, 2822
- **Acao:** Remover TODOS os console.log de debug ou migrar para logger condicional (`if (import.meta.env.DEV)`)
- **Impacto:** Performance + seguranca de informacao
- **Esforco:** 1h

### 1.2 Corrigir funcao `isWithinBusinessHours()` ausente
- **Arquivo:** `supabase/functions/process-satisfaction/index.ts` (linha 236)
- **Problema:** Funcao chamada mas NUNCA DEFINIDA — causa runtime error quando `send_only_business_hours: true`
- **Acao:** Implementar a funcao que valida se o horario atual esta dentro do `business_hours` JSONB da `company_settings`
- **Impacto:** Pesquisa de satisfacao QUEBRA quando config de horario comercial esta ativa
- **Esforco:** 2h

### 1.3 Remover dead code (mock data)
- **Arquivo:** `src/pages/Conversations.tsx` (linhas 296-387)
- **Problema:** 92 linhas de `mockConversations` e `mockMessages` nunca utilizados
- **Acao:** Deletar constantes mock
- **Esforco:** 15min

### 1.4 Validacao de telefone no agendamento de mensagens
- **Arquivo:** `supabase/functions/process-scheduled-messages/index.ts` (linha 78)
- **Problema:** Nenhuma validacao de formato de telefone antes de enviar — pode crashar API do provedor
- **Acao:** Adicionar validacao regex de telefone brasileiro antes do envio
- **Esforco:** 1h

### 1.5 Corrigir fallback de tenant_id em mensagens
- **Arquivo:** `src/hooks/useConversations.ts` (linha 229)
- **Problema:** `tenant_id: null` confia 100% em trigger do banco — se trigger falhar, mensagem fica sem isolamento de tenant
- **Acao:** Popular `tenant_id` no frontend via `get_user_tenant_id()` antes do INSERT
- **Impacto:** Risco de vazamento cross-tenant
- **Esforco:** 1h

---

## FASE 2 — ALTA PRIORIDADE (Semana 3-4) | Funcionalidades Incompletas

> Features que existem na UI mas nao funcionam. Usuario clica e nada acontece.

### 2.1 Implementar inicio de Chatbot Flow
- **Arquivo:** `src/pages/Conversations.tsx` (linha 5806)
- **Problema:** Botao "Iniciar Fluxo" no QuickTemplatesPopover mostra toast mas executa `// TODO: Implement flow start logic`
- **Hook existente:** `src/hooks/useChatbotFlows.ts` (404 linhas, CRUD completo)
- **Acao:**
  1. Conectar `onStartFlow()` ao hook `useChatbotFlows`
  2. Criar funcao `executeFlow(flowId, conversationId, contactId)`
  3. Inserir primeira mensagem do flow na conversa
  4. Registrar execucao no tracking
- **Esforco:** 4-6h

### 2.2 Implementar execucao de Triggers de Automacao
- **Arquivo:** `src/pages/Conversations.tsx` (linha 5810)
- **Problema:** Botao "Executar Trigger" mostra toast mas executa `// TODO: Implement trigger execution`
- **Acao:**
  1. Definir interface de trigger (webhook URL, payload, condicoes)
  2. Criar hook `useTriggerExecution()`
  3. Chamar webhook n8n com dados da conversa/contato
  4. Feedback de sucesso/erro ao usuario
- **Esforco:** 6-8h

### 2.3 Implementar scroll-to-message na busca
- **Arquivo:** `src/pages/Conversations.tsx` (linha 4391)
- **Problema:** Ao selecionar resultado da busca global, abre a conversa mas NAO rola ate a mensagem encontrada
- **Acao:**
  1. Receber `messageId` do resultado da busca
  2. Aguardar carregamento das mensagens
  3. `scrollIntoView()` na mensagem + highlight temporario (flash amarelo)
  4. Se mensagem nao estiver na pagina visivel, carregar pagina correta via cursor
- **Esforco:** 3-4h

### 2.4 Implementar SLA tracking completo
- **Problema:** Campos `sla_status`, `first_response_at` existem no banco mas NENHUMA logica de calculo/exibicao
- **Tabelas existentes:** `conversations.sla_status`, `conversations.first_response_at`, `company_settings.sla_first_response_minutes`
- **Acao:**
  1. Criar trigger: ao inserir primeira mensagem `is_from_me=true`, popular `first_response_at`
  2. Criar funcao `calculate_sla_status()` que compara tempo vs config
  3. Criar componente `SLABadge.tsx` (verde/amarelo/vermelho)
  4. Exibir badge na lista de conversas e header do chat
  5. Criar alerta quando SLA esta proximo de estourar
- **Esforco:** 8-12h

### 2.5 Completar fluxo de Pesquisa de Satisfacao
- **Arquivo:** `supabase/functions/process-satisfaction/index.ts`
- **Gaps:**
  - `isWithinBusinessHours()` nao existe (coberto na Fase 1.2)
  - Nao valida se contato tem telefone antes de enviar
  - Nao ha logica para capturar resposta do cliente
  - Nao ha auto-close da conversa apos resposta
- **Acao:**
  1. Implementar `isWithinBusinessHours()` (Fase 1.2)
  2. Adicionar validacao de telefone do contato
  3. Criar webhook/trigger para capturar resposta numerica do cliente
  4. Inserir resposta na tabela `satisfaction_surveys`
  5. Auto-fechar conversa apos captura com motivo "Pesquisa respondida"
- **Esforco:** 6-8h

---

## FASE 3 — MEDIA PRIORIDADE (Semana 5-8) | Refatoracao e Qualidade

> Melhorias estruturais que reduzem divida tecnica e preparam para escalar.

### 3.1 Refatorar Conversations.tsx (6.640 linhas → ~10 modulos)
- **Problema:** Componente monolitico impossivel de manter, testar ou revisar
- **Plano de decomposicao:**

| Novo Componente | Responsabilidade | Linhas Estimadas |
|----------------|-----------------|-----------------|
| `ConversationList.tsx` | Lista lateral + filtros + busca | ~800 |
| `ConversationFilters.tsx` | Painel de filtros avancados | ~400 |
| `MessageThread.tsx` | Area de mensagens + scroll infinito | ~1000 |
| `MessageInput.tsx` | Input de texto + audio + arquivo + emoji | ~600 |
| `MessageBubble.tsx` | Renderizacao individual de mensagem | ~400 |
| `ConversationHeader.tsx` | Header com nome, status, acoes | ~300 |
| `BulkActionsPanel.tsx` | Barra de acoes em massa | ~300 |
| `ConversationLayout.tsx` | Layout responsivo (3 paineis) | ~200 |
| `useConversationState.ts` | Estado unificado do modulo | ~400 |
| `useConversationRealtime.ts` | Todas subscricoes realtime | ~500 |

- **Estrategia:** Extrair bottom-up (componentes folha primeiro), manter testes verdes em cada step
- **Esforco:** 20-30h (2-3 sprints)

### 3.2 Implementar testes unitarios (cobertura zero → 60%)
- **Problema:** ZERO testes no projeto inteiro
- **Prioridade de testes:**

| Prioridade | O que testar | Framework |
|------------|-------------|-----------|
| P0 | `useSendMessage` - envio + optimistic update | Vitest + React Testing Library |
| P0 | `useBulkConversationActions` - operacoes em massa | Vitest |
| P0 | `useTransferConversation` - transferencia | Vitest |
| P1 | `process-scheduled-messages` - edge function | Deno test |
| P1 | `process-satisfaction` - edge function | Deno test |
| P1 | `usePaginatedConversations` - paginacao + filtros | Vitest |
| P2 | `AudioRecorder` - gravacao de audio | Vitest + mock MediaStream |
| P2 | `FileUploader` - upload + validacao | Vitest |
| P2 | `use24hWindow` - calculo janela 24h | Vitest |

- **Acao:**
  1. Configurar Vitest + React Testing Library
  2. Criar `src/__tests__/` com estrutura espelhando `src/`
  3. Implementar testes P0 primeiro (core de mensagens)
  4. Meta: 60% cobertura em hooks de conversas
- **Esforco:** 15-20h

### 3.3 Adicionar acessibilidade (A11y)
- **Problema:** Apenas 1 `aria-label` em 6.640 linhas
- **Acao:**

| Area | Melhoria |
|------|----------|
| Lista de conversas | `role="listbox"`, `aria-selected`, navegacao por setas |
| Mensagens | `aria-live="polite"` para novas mensagens |
| Botoes de acao | `aria-label` em todos os icon buttons |
| Typing indicator | `aria-live="assertive"` para anunciar digitacao |
| Emoji picker | `role="dialog"`, `aria-label="Selecionar emoji"` |
| Status de mensagem | `aria-label` descritivo (ex: "Mensagem entregue") |
| Busca | `role="search"`, `aria-expanded` para dropdown |
| Modais | Focus trap, `aria-modal="true"`, ESC para fechar |

- **Esforco:** 8-12h

### 3.4 Implementar Logger condicional
- **Problema:** 66 console.logs de debug + logs nas edge functions sem padrao
- **Acao:**
  1. Criar utility `src/utils/logger.ts`
  2. Niveis: `debug`, `info`, `warn`, `error`
  3. `debug` so executa quando `import.meta.env.DEV === true`
  4. `error` envia para servico de monitoramento (Sentry/LogRocket)
  5. Substituir todos os `console.log` por `logger.debug()`
- **Esforco:** 4-6h

---

## FASE 4 — EVOLUCAO (Semana 9-12) | Novas Features e Melhorias

> Funcionalidades novas que agregam valor ao produto.

### 4.1 Multi-canal (alem do WhatsApp)
- **Estado atual:** Apenas WhatsApp (oficial + nao-oficial)
- **Oportunidade:** Schema ja suporta canais genericos
- **Roadmap:**

| Canal | Complexidade | Dependencias |
|-------|-------------|-------------|
| Instagram DM | Media | Meta Graph API, OAuth |
| Facebook Messenger | Media | Meta Graph API, OAuth |
| Email (SMTP/IMAP) | Alta | Integracao email externo (nao o interno) |
| Webchat (Widget) | Media | Componente embeddable, WebSocket |
| Telegram | Baixa | Telegram Bot API |
| SMS | Baixa | Twilio/Vonage API |

- **Acao:**
  1. Abstrair camada de provedor (`ChannelProvider` interface)
  2. Criar adapter pattern: `WhatsAppProvider`, `InstagramProvider`, etc.
  3. UI: Seletor de canal no header da conversa
  4. Migrar `whatsapp_channels` → `channels` (tabela generica)
- **Esforco:** 40-60h por canal

### 4.2 Chatbot Flow Builder visual
- **Estado atual:** CRUD de flows existe mas sem builder visual
- **Acao:**
  1. Integrar React Flow (react-flow.dev) para editor drag-and-drop
  2. Tipos de node: Mensagem, Condicao, Delay, Webhook, Transferir
  3. Preview do flow antes de publicar
  4. Execucao stepada com tracking visual
- **Esforco:** 30-40h

### 4.3 Dashboard de SLA e Metricas em tempo real
- **Estado atual:** Tabela `daily_metrics` existe mas sem dashboard
- **Acao:**
  1. Criar pagina `/dashboard/conversations`
  2. Cards: Tempo medio 1a resposta, Tempo medio resolucao, SLA compliance %
  3. Graficos: Volume por hora, por dia, por agente
  4. Ranking de agentes por performance
  5. Alertas de SLA proximo de estourar
- **Esforco:** 15-20h

### 4.4 Sistema de respostas automaticas (Auto-reply)
- **Estado atual:** Nao implementado
- **Acao:**
  1. Criar tabela `auto_reply_rules` (condicao, resposta, horario, canal)
  2. Tipos: Fora do horario, Primeira mensagem, Keyword match
  3. UI de configuracao em Settings
  4. Edge function que intercepta webhook antes do roteamento
- **Esforco:** 12-16h

### 4.5 Relatorios exportaveis
- **Estado atual:** Contadores existem mas sem export
- **Acao:**
  1. Export CSV/Excel de conversas com filtros
  2. Export PDF de historico de conversa individual
  3. Relatorio de performance por agente (periodo)
  4. Relatorio de satisfacao (NPS/CSAT agregado)
- **Esforco:** 10-15h

### 4.6 Melhorias no Audio
- **Estado atual:** Gravacao MP3 funcional
- **Melhorias:**
  1. Transcricao automatica (Whisper API / Google Speech-to-Text)
  2. Waveform visual durante gravacao e playback
  3. Velocidade de playback (1x, 1.5x, 2x) — padrao WhatsApp
  4. Audio pre-gravado em templates com preview
- **Esforco:** 15-20h

### 4.7 Notificacoes push (PWA)
- **Estado atual:** Apenas toast in-app e som
- **Acao:**
  1. Registrar Service Worker para push notifications
  2. Solicitar permissao do navegador
  3. Push quando: nova mensagem, transferencia, SLA alert
  4. Badge no favicon com contagem de nao lidas
- **Esforco:** 8-12h

---

## CRONOGRAMA RESUMIDO

```
Semana 1-2  │ FASE 1: Bugs criticos em producao
            │ ├── 1.1 Remover console.logs (1h)
            │ ├── 1.2 Fix isWithinBusinessHours (2h)
            │ ├── 1.3 Remover dead code (15min)
            │ ├── 1.4 Validacao telefone (1h)
            │ └── 1.5 Fix tenant_id fallback (1h)
            │
Semana 3-4  │ FASE 2: Features incompletas
            │ ├── 2.1 Chatbot flow start (4-6h)
            │ ├── 2.2 Trigger execution (6-8h)
            │ ├── 2.3 Scroll-to-message (3-4h)
            │ ├── 2.4 SLA tracking (8-12h)
            │ └── 2.5 Pesquisa satisfacao (6-8h)
            │
Semana 5-8  │ FASE 3: Refatoracao e qualidade
            │ ├── 3.1 Decompor Conversations.tsx (20-30h)
            │ ├── 3.2 Testes unitarios 0→60% (15-20h)
            │ ├── 3.3 Acessibilidade A11y (8-12h)
            │ └── 3.4 Logger condicional (4-6h)
            │
Semana 9-12 │ FASE 4: Evolucao
            │ ├── 4.1 Multi-canal (40-60h/canal)
            │ ├── 4.2 Flow builder visual (30-40h)
            │ ├── 4.3 Dashboard metricas (15-20h)
            │ ├── 4.4 Auto-reply (12-16h)
            │ ├── 4.5 Relatorios export (10-15h)
            │ ├── 4.6 Melhorias audio (15-20h)
            │ └── 4.7 Push notifications (8-12h)
```

---

## MATRIZ DE RISCO vs IMPACTO

```
IMPACTO ALTO
    │
    │  ★ 1.2 isWithinBusinessHours    ★ 2.4 SLA Tracking
    │  ★ 1.5 tenant_id fix            ★ 4.1 Multi-canal
    │  ★ 2.1 Chatbot flow             ★ 4.2 Flow builder
    │  ★ 2.2 Triggers                 ★ 4.3 Dashboard
    │
    ├──────────────────────────────────────────────────
    │
    │  ★ 1.1 Console logs             ★ 3.1 Refatoracao
    │  ★ 1.4 Validacao telefone       ★ 3.2 Testes
    │  ★ 2.3 Scroll-to-message        ★ 4.4 Auto-reply
    │  ★ 2.5 Satisfacao               ★ 4.7 Push notifs
    │
IMPACTO BAIXO
    └───────────────────────────────────────────────
    ESFORCO BAIXO                    ESFORCO ALTO
```

---

## METRICAS DE SUCESSO

| Metrica | Atual | Meta Fase 2 | Meta Fase 4 |
|---------|-------|-------------|-------------|
| Bugs criticos em producao | 5 | 0 | 0 |
| Features com TODO/stub | 3 | 0 | 0 |
| Console.logs de debug | 66 | 0 | 0 |
| Cobertura de testes | 0% | 30% | 60% |
| ARIA labels | 1 | 20+ | 50+ |
| Tamanho maior componente | 6.640 linhas | 6.640 | <1.000 |
| Canais suportados | 1 (WhatsApp) | 1 | 3+ |
| Tempo medio 1a resposta | Nao medido | Medido | < 5min |
| SLA compliance | Nao rastreado | Rastreado | > 90% |

---

## DEPENDENCIAS ENTRE TAREFAS

```
1.2 isWithinBusinessHours ──→ 2.5 Pesquisa Satisfacao
1.5 tenant_id fix ──→ (todas as features de mensagem)
2.4 SLA tracking ──→ 4.3 Dashboard metricas
3.1 Refatoracao ──→ 3.2 Testes (mais facil testar modulos menores)
3.4 Logger ──→ 1.1 Console logs (substituir por logger)
4.1 Multi-canal ──→ 4.2 Flow builder (flows multi-canal)
```

---

## RESPONSAVEIS SUGERIDOS

| Fase | Perfil Necessario |
|------|------------------|
| Fase 1 | Dev fullstack (qualquer nivel) |
| Fase 2 | Dev fullstack senior (Supabase + React) |
| Fase 3 | Dev frontend senior + QA |
| Fase 4 | Equipe completa (front + back + design) |

---

*Plano gerado em 25/02/2026 com base na auditoria tecnica completa do codebase.*
*Referencia: docs/PRD-CONVERSAS.md*
