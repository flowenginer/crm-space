# Spec — Templates Meta em Mensagens Agendadas

**Data:** 22/04/2026
**Autor:** Mateus (direcao) + Claude (execucao)
**Status:** Aprovada

## Contexto

O modal de agendamento (`ScheduleMessageModal`) hoje permite enfileirar texto, audio, imagem, video ou documento em `scheduled_messages`. Quando chega a hora, `process-scheduled-messages` envia pela Evolution/UAZAPI/ZAPI ou via `cloudapi-send-message` (Meta Cloud API).

Gap: quando a janela de 24h esta fechada, somente **templates Meta aprovados** podem reabrir a conversa. Hoje o agendamento nao suporta templates — se a data agendada cair fora da janela, o envio falha.

## Decisao

Opcao A: toggle explicito no modal — "Mensagem Livre" (fluxo atual) x "Template Meta" (novo).

## Dominio / schema

Tabela `scheduled_messages` ja tem:
- `variables jsonb` — sera reusado para `{ "1": "Marcilene", "2": "Farofa" }`
- `message_type text` (sem CHECK) — aceita `'template'` sem migration de constraint
- `template_id uuid` — ja aponta para `message_templates` (quick messages legadas). Nao mexer.

Novas colunas:

```sql
ALTER TABLE public.scheduled_messages
  ADD COLUMN IF NOT EXISTS meta_template_id uuid
    REFERENCES public.meta_message_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS template_name text,
  ADD COLUMN IF NOT EXISTS template_language text,
  ADD COLUMN IF NOT EXISTS template_components jsonb,
  ADD COLUMN IF NOT EXISTS template_header_media_url text;

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_meta_template
  ON public.scheduled_messages(meta_template_id)
  WHERE meta_template_id IS NOT NULL;
```

**Por que snapshot (`template_components` jsonb)?** Se o template for desativado, recriado ou re-sincronizado da Meta entre o agendamento e o disparo, o operador veria algo diferente do que agendou. Congelar os components no momento do agendamento garante previsibilidade.

**RLS:** as policies existentes (`Tenant isolation for scheduled_messages` + policies por `created_by`) cobrem as novas colunas automaticamente.

## Fluxo UI (`ScheduleMessageModal`)

1. Aba "Nova Mensagem" ganha um `ToggleGroup` no topo:
   - `Mensagem Livre` (default, fluxo atual intocado)
   - `Template Meta`
2. Em modo Template:
   - Select de `meta_message_templates` com `status='APPROVED'`
   - Se o template tem variaveis, renderiza campos numerados `{{1}}`, `{{2}}`, etc.
   - Se tem header IMAGE/VIDEO/DOCUMENT sem `header_media_url` cadastrado, exibe campo URL obrigatorio
   - Preview WhatsApp-style (reusa mesma formula do `MetaTemplateUseModal`)
   - Botao "Agendar Template" valida campos, monta `components` e insere em `scheduled_messages`
3. Validacao: data futura + template selecionado + todas vars preenchidas (+ media URL se obrigatoria)

## Fluxo envio (`process-scheduled-messages`)

Quando `message_type = 'template'`:
1. Verificar que `channel.type IN ('cloudapi','official')`. Caso contrario, marcar `failed` com mensagem clara ("Template Meta requer canal Cloud API oficial").
2. Substituir variaveis dinamicas (`{{nome}}`, `{{saudacao}}`, etc) **dentro dos valores** de `variables` jsonb antes de montar components — ou aplicar a mesma logica `replaceVariables` do texto livre em cada variable. Decisao: aplicar em cima dos values do jsonb, mantendo compatibilidade com quem quiser `{{nome}}` no variable `{{1}}`.
3. Invocar `cloudapi-send-message` com:
   ```json
   {
     "channelId": "...",
     "phone": "...",
     "type": "template",
     "template": {
       "name": "...",
       "language": "pt_BR",
       "components": [ ...montados dinamicamente... ]
     },
     "conversationId": "..."
   }
   ```
4. Gravar `messages` row com `content = preview renderizado` + `message_type='template'` (para aparecer no chat).

## Util compartilhado (testavel)

`src/lib/scheduled-template-utils.ts`:
- `buildTemplateComponentsPayload(template, variables, headerMediaUrl?)` — retorna array pronto pro Graph API (HEADER com parameters image/video/document, BODY com parameters texto, respeita HEADER de texto com var).
- `renderTemplatePreview(template, variables)` — retorna string pronta pro operador ver no modal + na tabela de agendadas.

Testes (Vitest):
- Body sem vars → components so com BODY vazio de parameters.
- Body com 2 vars → components com BODY + 2 parameters texto.
- HEADER IMAGE com `headerMediaUrl` → HEADER com image link.
- HEADER TEXT com `{{1}}` → HEADER com parameters texto.
- Preview renderiza vars + header/footer corretamente.

## Nao-escopo

- Nao detectar janela de 24h automaticamente (fragil — janela pode fechar/abrir entre agendar e disparar).
- Nao criar UI para editar templates agendados (cancelar + reagendar e suficiente).
- Nao migrar scheduled_messages legadas.

## Riscos

- Template pode ficar `PAUSED/REJECTED/DELETED` entre agendar e disparar → envio falha com erro do Meta. Aceito: mostrar erro claro no `scheduled_messages.error_message` e deixar operador cancelar + reagendar.
- Canal trocar de CloudAPI para Evolution antes do disparo → falha explicita "canal nao suporta templates Meta".

## Arquivos tocados

- `supabase/migrations/{ts}_add_meta_template_to_scheduled_messages.sql` (novo)
- `src/lib/scheduled-template-utils.ts` (novo)
- `src/lib/__tests__/scheduled-template-utils.test.ts` (novo)
- `src/components/conversations/ScheduleMessageModal.tsx` (ajuste)
- `supabase/functions/process-scheduled-messages/index.ts` (ajuste)
