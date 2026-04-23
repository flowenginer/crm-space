# PROGRESS — CRM Space

Registro cronológico das alterações significativas. Sessão mais recente no topo.

---

## 2026-04-23 — Templates Meta em Mensagens Agendadas

**Problema:** O modal de agendamento (icone calendario na barra de conversas) suportava texto, audio, imagem, video e documento, mas nao templates Meta. Quando a data agendada caia fora da janela de 24h do WhatsApp, o envio falhava porque so templates aprovados podem reabrir conversa.

**Decisao:** Opcao A da spec — toggle explicito "Mensagem Livre" x "Template Meta" no modal, em vez de auto-detectar janela de 24h (fragil).

**Spec:** `docs/spec-scheduled-meta-templates.md`

### O que mudou

**Schema (`scheduled_messages`):**
- `meta_template_id uuid` — FK para `meta_message_templates`, ON DELETE SET NULL
- `template_name text`
- `template_language text`
- `template_components jsonb` — **snapshot** dos components no momento do agendamento (evita divergencia se template for alterado/removido antes do disparo)
- `template_header_media_url text`
- Index parcial `idx_scheduled_messages_meta_template` em `meta_template_id`
- `message_type` aceita valor `'template'` (nao tinha CHECK, sem ALTER necessario)
- Coluna `variables jsonb` ja existia, foi reusada para `{ "1": "Marcilene", ... }`
- Migration aplicada em prod: `20260422120000_add_meta_template_to_scheduled_messages`

**UI (`src/components/conversations/ScheduleMessageModal.tsx`):**
- `ToggleGroup` com `Mensagem Livre` (default, fluxo original intocado) e `Template Meta`
- Modo template: `Select` de templates `status='APPROVED'` (via `useApprovedMetaTemplates`), form dinamico de variaveis, campo de media URL quando header e IMAGE/VIDEO/DOCUMENT sem `header_media_url` cadastrado, preview estilo WhatsApp
- Valida canal `whatsapp_channels.type IN ('cloudapi','official')` antes do insert — templates so funcionam em Cloud API oficial
- Badge "Template" na aba Agendadas (lista de scheduled_messages do contato)

**Edge function (`supabase/functions/process-scheduled-messages/index.ts`):**
- Branch dedicado no inicio do loop quando `scheduled.message_type === 'template'` (precedencia sobre o fluxo CloudAPI/provider)
- Aplica `replaceVariables` (nome, telefone, email, data, saudacao, atendente) em cima dos valores do jsonb `variables` — permite usar `{{nome}}` como valor de variavel Meta `{{1}}`
- Monta components via shared `buildTemplateComponentsPayload`
- Invoca `cloudapi-send-message` com `type: 'template'`, repassando `conversationId` pro webhook enriquecido
- Falha explicita quando canal nao e CloudAPI: `"Templates Meta so podem ser enviados em canais Cloud API oficial"`
- Fluxo livre (text/audio/image/video/document) 100% intocado

**Shared (novo):**
- `supabase/functions/_shared/meta-template-payload.ts` — builder e tipos compartilhados entre edge (Deno) e browser (Vite). Fonte unica de verdade.
- `src/lib/scheduled-template-utils.ts` — wrapper browser que usa a MESMA logica, com helpers adicionais (`renderTemplatePreview`, `countTotalTemplateVariables`)

### Testes (34 novos)

- `src/lib/__tests__/scheduled-template-utils.test.ts` — 13 testes do util browser
- `supabase/functions/_shared/__tests__/meta-template-payload.test.ts` — 14 testes do util edge + **4 testes de paridade** garantindo que edge e browser retornam o mesmo payload pros mesmos inputs
- `src/components/conversations/__tests__/ScheduleMessageModal.test.tsx` — 7 testes de integracao (toggle, render condicional, disabled states)

Comandos:
- `npx vitest run src/lib/__tests__/scheduled-template-utils.test.ts`
- `npx vitest run supabase/functions/_shared/__tests__/meta-template-payload.test.ts`
- `npx vitest run src/components/conversations/__tests__/ScheduleMessageModal.test.tsx`

### Gotchas pra proxima sessao

1. **Util duplicado de propósito.** Se alterar a logica de montagem do payload, mexer nos DOIS: `supabase/functions/_shared/meta-template-payload.ts` (edge) E `src/lib/scheduled-template-utils.ts` (browser usa helpers adicionais mas a funcao `buildTemplateComponentsPayload` e independente). Os testes de paridade em `supabase/functions/_shared/__tests__/meta-template-payload.test.ts` pegam divergencia automaticamente.

2. **types.ts desatualizado.** `src/integrations/supabase/types.ts` nao conhece as 5 colunas novas. Nao quebra runtime (tsconfig nao-strict), mas falta autocomplete. Regenerar com `mcp__up-supa__generate_typescript_types` (project `lkxrmjqrzhaivviuuamp`) quando for conveniente.

3. **Snapshot vs live fetch.** `template_components` e snapshot no momento do agendamento. Se o user reportar que o template enviado nao bate com o que vê em Meta Templates, pode ser porque o template foi editado apos o agendamento — e o snapshot preserva a versao antiga intencionalmente.

4. **Canal pode trocar entre agendar e disparar.** Se operador mudar o canal de CloudAPI pra Evolution depois de agendar um template, a edge function marca `failed` com mensagem clara. Nao ha auto-fallback pra Evolution (impossivel, Evolution nao fala templates Meta).

5. **Template pode ficar REJECTED/PAUSED/DELETED entre agendar e disparar.** O envio falha com erro da Meta, gravado em `scheduled_messages.error_message`. Operador cancela + reagenda.

6. **Testes pre-existentes quebrados (nao introduzidos por essa task):**
   - `src/hooks/__tests__/usePreOrderBling.test.ts` — mock de blingApi
   - `src/components/conversations/__tests__/PreOrderBlingModal.test.tsx` — falta QueryClientProvider
   - Confirmei por stash: falhavam antes do meu trabalho. Nao mexer aqui, e outra task.

### Arquivos tocados

Novos:
- `docs/spec-scheduled-meta-templates.md`
- `supabase/migrations/20260422120000_add_meta_template_to_scheduled_messages.sql`
- `supabase/functions/_shared/meta-template-payload.ts`
- `supabase/functions/_shared/__tests__/meta-template-payload.test.ts`
- `src/lib/scheduled-template-utils.ts`
- `src/lib/__tests__/scheduled-template-utils.test.ts`
- `src/components/conversations/__tests__/ScheduleMessageModal.test.tsx`
- `PROGRESS.md` (este arquivo)

Modificados:
- `src/components/conversations/ScheduleMessageModal.tsx`
- `supabase/functions/process-scheduled-messages/index.ts`

### Commits (em `main`)

- `d91293b` feat: adiciona suporte a templates Meta em mensagens agendadas (spec + migration + shared)
- `cedc902` test: utils de template agendado + paridade edge/client + integracao modal
- `e5b57c6` feat: modal e edge function para templates Meta em agendamentos

Fluxo usado: branch `feat/meta-templates-scheduled`, validada com testes + build + tsc, fast-forward pra `main`, branch deletada.
