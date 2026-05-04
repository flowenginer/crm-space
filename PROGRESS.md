# PROGRESS — CRM Space

Registro cronológico das alterações significativas. Sessão mais recente no topo.

---

## 2026-05-04 — Pause da edge `instagram-webhook` via stub (restauração do CRM)

**Motivo:** solicitação de restauração do CRM. Meta já está bloqueado (não envia webhooks pra esse app), mas optamos por pausar a edge `instagram-webhook` mesmo assim — pra garantir que o endpoint não processe nada enquanto durar a restauração, mesmo se algum tráfego (teste, ping, ferramenta de monitoramento, etc) chegar nela.

**O que foi feito:**

- Backup do código deployado (versão 36) salvo em `docs/backups/instagram-webhook-index-2026-05-04.ts` — fora da pasta da function pra Supabase não tentar bundlear.
- `supabase/functions/instagram-webhook/index.ts` substituído por um **stub** que retorna 503 imediato pra qualquer GET ou POST, sem ler config, sem rodar lógica, sem logar evento em `instagram_webhook_logs`.
- Redeploy via `mcp__up-supa__deploy_edge_function` no projeto Supabase `lkxrmjqrzhaivviuuamp` (`verify_jwt=false`, igual ao original).

**Stub deployado:**

```ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
serve(() =>
  new Response("Webhook desativado para restauracao do CRM", {
    status: 503,
    headers: { "Content-Type": "text/plain" },
  })
);
```

**Como reverter (quando a restauração for aprovada):**

1. Copiar o conteúdo de `docs/backups/instagram-webhook-index-2026-05-04.ts` (a partir do `import { serve }`) para `supabase/functions/instagram-webhook/index.ts`, sobrescrevendo o stub.
2. Redeploy:
   ```
   mcp__up-supa__deploy_edge_function({
     project_id: 'lkxrmjqrzhaivviuuamp',
     name: 'instagram-webhook',
     entrypoint_path: 'index.ts',
     verify_jwt: false,
     files: [{ name: 'index.ts', content: <conteúdo do backup> }]
   })
   ```
3. Validar via `mcp__up-supa__get_edge_function` que a versão nova está `ACTIVE`.
4. Adicionar entrada nova neste PROGRESS.md anotando a reversão.

**Histórico desta sessão (descartado):**

O commit anterior (`dd6444b`) tinha registrado um pause via `UPDATE instagram_configs SET is_active=false`. Foi revertido logo em seguida (`is_active=true` de volta às 22:01 UTC) porque a abordagem não atendia o objetivo: a edge function continuava recebendo a requisição, só não achava config ativa e fazia early return. O que se queria era a edge **em si** não processar nada — daí o stub.

**Arquivos tocados no repo:**

Novos:
- `docs/backups/instagram-webhook-index-2026-05-04.ts` (snapshot do código original)

Modificados:
- `supabase/functions/instagram-webhook/index.ts` (substituído por stub)
- `PROGRESS.md` (este arquivo — entrada antiga substituída)

---

## 2026-05-04 — Troca de Senha pelo Vendedor (autoatendimento)

**Problema:** Vendedores não tinham como trocar a própria senha. Toda definição/troca passava pelo admin (Ricardo Grion), que precisava saber a senha — fricção operacional + de privacidade.

**Decisão:** Página dedicada `/minha-conta` com seção "Trocar Senha". Sem pedir senha atual (UX simplificada, trade-off aceito explicitamente). Política forte: 8 chars + maiúscula + minúscula + número + símbolo. Sem edge function — usar `supabase.auth.updateUser` direto (o JWT da sessão atual já autoriza a troca pra si mesmo).

**Spec:** `docs/spec-troca-senha-vendedor.md` (versão original com decisões já tomadas)

### O que mudou

**Validação compartilhada (`src/lib/passwordValidation.ts`):**
- `passwordSchema` (Zod): regex em sequência cobrindo 5 critérios com mensagens em PT-BR
- `changePasswordSchema`: combina nova + confirmação, com `refine` validando igualdade
- `evaluatePassword(password)`: retorna os 5 critérios anotados com `met: boolean` — alimenta a UI em tempo real
- `translateSupabaseAuthError(message)`: mapeia mensagens conhecidas da Supabase Auth pra PT-BR ("New password should be different from the old password" → "A nova senha precisa ser diferente da atual"). Cobre 5 famílias de erro + fallback que retorna a mensagem original

**Página (`src/pages/MinhaConta.tsx`):**
- Cabeçalho "Minha Conta" + descrição
- Card "Dados Pessoais" (read-only): nome (`profile.full_name`), e-mail (do `auth.users`), perfil (`profile.role`), departamento (query separada via `useQuery` em `departments`)
- Card "Trocar Senha":
  - Inputs `Nova senha` + `Confirmar nova senha` com toggle olho (Eye/EyeOff)
  - Lista de critérios em tempo real com Check (verde) ou X (cinza) por item — `data-testid` por critério pra testar
  - Estado visual da confirmação (border verde/vermelho conforme bate)
  - Botão `Salvar nova senha` desabilitado até `allCriteriaMet && passwordsMatch && !isLoading`
- Submit: `supabase.auth.updateUser({ password })` → `toast.success` + `setTimeout(() => navigate('/'), 1500)`. Erro → `toast.error(translateSupabaseAuthError(error.message))` mantendo form preenchido

**Rota (`src/App.tsx`):**
- `<Route path="/minha-conta" element={<ProtectedRoute><MinhaConta /></ProtectedRoute>} />` dentro do bloco `MainLayout`
- Sem `permission` específica — qualquer user logado com tenant acessa

**Sidebar (`src/components/layout/Sidebar.tsx`):**
- Avatar + nome do usuário no footer agora envolvidos por `<button onClick={() => navigate('/minha-conta')}>` com `hover:opacity-80` e `focus-visible:ring`. Funciona tanto no estado expandido quanto no collapsed
- Botões "bell" e "logout" continuam separados à direita (não viram parte do botão de navegação)
- Sem item de menu novo (decisão da spec: manter sidebar limpo)

### Testes (33 novos, todos passando)

- `src/lib/__tests__/passwordValidation.test.ts` — 22 testes
  - 6 testes do `passwordSchema` (cada critério individual + senha forte completa)
  - 3 testes do `changePasswordSchema` (mismatch, fraca, válida)
  - 6 testes de `evaluatePassword` (vazia, cada critério individual, todas atendidas, contagem de critérios)
  - 7 testes de `translateSupabaseAuthError` (5 famílias mapeadas + fallback)
- `src/pages/__tests__/MinhaConta.test.tsx` — 11 testes
  - Render: dados pessoais, critérios pendentes inicialmente, botão desabilitado
  - Validação tempo real: critérios marcam conforme digita, botão habilita/desabilita conforme regras
  - Toggle olho: alterna `type=password` ↔ `type=text`
  - Submit: sucesso + redirect, mensagem traduzida em erro conhecido, form mantido após erro

**Resultado:** 33/33 novos passando. Suite total: 100 passing + 7 falhas pré-existentes em Bling (intocadas — `usePreOrderBling`, `PreOrderBlingModal`, `blingSync`). `tsc -b` limpo.

### Decisões que ficaram fora (da spec original, intencionalmente)

- Reset por email ("Esqueci minha senha")
- Forçar troca no primeiro login
- Painel admin com lista/auditoria de senhas — **NUNCA**: senha em hash bcrypt no Auth, expor viola LGPD
- Impersonate (admin entrar como vendedor)
- Pedir senha atual antes de trocar — explicitamente decidido por simplicity-first; risco aceito (alguém com aba aberta consegue trocar). Pode ser reconsiderado no futuro

### Pendência operacional (não-código)

- Confirmar no painel Supabase Auth (`Auth > Policies > Password requirements`) que o mínimo nativo está em 8 caracteres ou menos. As regras de complexidade (maiúscula/minúscula/número/símbolo) são validadas só pelo frontend — o backend Supabase aceita qualquer senha que passe no mínimo dele

### Arquivos tocados

Novos:
- `docs/spec-troca-senha-vendedor.md` (spec original, restaurada e tracked)
- `src/lib/passwordValidation.ts`
- `src/lib/__tests__/passwordValidation.test.ts`
- `src/pages/MinhaConta.tsx`
- `src/pages/__tests__/MinhaConta.test.tsx`

Modificados:
- `src/App.tsx` (import + rota)
- `src/components/layout/Sidebar.tsx` (`useNavigate` + avatar/nome envolvidos por `<button>`)
- `PROGRESS.md` (este arquivo)

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
