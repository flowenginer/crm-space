# Fix Orphan Conversations Cross-Channel — 06/05/2026

Resumo do incidente reportado pelo cliente Space Sports e cleanup completo aplicado em produção (Supabase project `lkxrmjqrzhaivviuuamp`, tenant `00000000-0000-0000-0000-000000000001`).

## Bug reportado

> *"Cliente Adriano José da Silva / ADRIANO RECEPTIVO em contatos diz que está no Vendas 02 e API Oficial. Não conseguimos encontrar o usuário dele da API Oficial — informa que ele já tem chat aberto. Hoje só comunicamos via API Oficial."*

## Causa raiz

1. Contato `c8e6af47-30bb-400d-9ca2-34446e9f4c82` tinha **2 conversations open simultâneas**:
   - `2c08cb83` em API_Oficial (channel `ee310180`, type=official, **assigned_to=NULL, department_id=NULL**) — invisível por RLS.
   - `2bd8c770` em VENDAS 02 (channel `724d0cc8`, type=unofficial, **disconnected**).
2. **RLS bloqueava SELECT da conv official** pra atendente comum (policies exigem `assigned_to=auth.uid()`, `department_id IN user_departments`, ou perfil admin/supervisor — todas falham com NULL/NULL).
3. **Toast bloqueava criação de nova conv** via unique index parcial `(contact_id, channel_id) WHERE status IN ('open','pending')` (migration `20251208032220`).
4. **Sistêmico**: 1.576 contatos afetados. Estado herdado das migrations 12/2025–03/2026 que migraram `channel_id` em massa (Evolution→UAZAPI, redistribuições VENDAS XX) sem fechar as conversas órfãs em canais antigos.

## Fix aplicado em 3 fases

### A.1 — Fechar conversations em canais disconnected com alternativa connected

```sql
UPDATE conversations conv
SET status = 'closed', closed_at = now(), updated_at = now()
FROM whatsapp_channels wc
WHERE conv.channel_id = wc.id
  AND conv.status IN ('open','pending')
  AND wc.status = 'disconnected'
  AND EXISTS (
    SELECT 1 FROM conversations c2
    JOIN whatsapp_channels wc2 ON wc2.id = c2.channel_id
    WHERE c2.contact_id = conv.contact_id
      AND c2.status IN ('open','pending')
      AND wc2.status = 'connected'
      AND wc2.tenant_id = wc.tenant_id
  );
```

**Resultado**: 1.014 conversas fechadas.

### A.2 — Atribuir department do canal a conversations órfãs em canais official

```sql
UPDATE conversations conv
SET department_id = wc.department_id, updated_at = now()
FROM whatsapp_channels wc
WHERE conv.channel_id = wc.id
  AND conv.status IN ('open','pending')
  AND wc.type = 'official'
  AND conv.department_id IS NULL
  AND wc.department_id IS NOT NULL;
```

**Resultado**: 938 conversas com department_id atribuído.

### A.3 — Herdar assigned_to + department_id de pares closed/open

Passo A.2 atribuiu department do canal (Sala de espera IA) — correto pra inbound novo, mas atendente histórico (que estava na VENDAS XX disconnected) ficou sem acesso. Atendentes como Waleska Brum não viam mais as conversas dos próprios clientes.

A.3 copia `assigned_to` + `department_id` da conv VENDAS XX closed pela A.1 para a conv API_Oficial open. Tiebreaker pra ambiguidade (≥2 closed): `last_message_at DESC`, depois `created_at DESC`. Se o `assigned_to` aponta pra profile inativo, herda só o `department_id`.

```sql
WITH ranked_closed AS (
  SELECT bk.contact_id, bk.assigned_to, bk.department_id,
         ROW_NUMBER() OVER (
           PARTITION BY bk.contact_id
           ORDER BY (bk.last_message_at IS NULL),
                    bk.last_message_at DESC NULLS LAST,
                    bk.created_at DESC, bk.id
         ) AS rn
  FROM backup_conversations_orphan_cleanup_20260506 bk
  WHERE bk.cleanup_op = 'A1_close_disconnected_with_active_alt'
    AND bk.assigned_to IS NOT NULL
),
target_open AS (
  SELECT bk.id AS conv_id, bk.contact_id
  FROM backup_conversations_orphan_cleanup_20260506 bk
  JOIN conversations conv ON conv.id = bk.id
  WHERE bk.cleanup_op = 'A2_assign_department_from_channel'
    AND conv.status = 'open'
    AND conv.assigned_to IS NULL
),
plan AS (
  SELECT t.conv_id, rc.assigned_to AS new_assigned_to,
         rc.department_id AS new_department_id, p.is_active AS profile_active
  FROM target_open t
  JOIN ranked_closed rc ON rc.contact_id = t.contact_id AND rc.rn = 1
  LEFT JOIN profiles p ON p.id = rc.assigned_to
)
UPDATE conversations c
SET assigned_to  = CASE WHEN pl.profile_active = true THEN pl.new_assigned_to ELSE c.assigned_to END,
    department_id = COALESCE(pl.new_department_id, c.department_id)
FROM plan pl
WHERE c.id = pl.conv_id;
```

**Resultado**: 222 conversas atualizadas (220 com assigned_to+dept, 2 com profile inativo herdando só dept).

## Camada preventiva (migration `20260506153643`)

Duas triggers garantem que o problema não volte por novos call sites:

- **`conversations_fill_department_default`** (BEFORE INSERT OR UPDATE OF channel_id): preenche `conversations.department_id` do canal quando NULL.
- **`conversations_close_disconnected_dupes`** (AFTER INSERT): quando insere conv open/pending em canal connected, fecha automaticamente conversations open/pending do mesmo contato em canais disconnected do mesmo tenant.

Ver migration `supabase/migrations/20260506153643_add_conversation_department_fill_and_close_dupe_triggers.sql` e tests `supabase/tests/database/conversation_triggers.test.sql`.

## Backups criados

Mantidos em produção por enquanto pra rollback se necessário. Podem ser dropados após 30 dias de validação.

- `public.backup_conversations_orphan_cleanup_20260506` — 1.952 linhas (estado pré-A.1+A.2).
- `public.backup_conversations_a3_assignee_inheritance_20260506` — 223 linhas (estado pré-A.3).

## Validação caso Adriano

| Conv | Canal | Antes | Após A.1+A.2 | Após A.3 |
|---|---|---|---|---|
| `2c08cb83` | API_Oficial connected | open, dept=NULL, assigned=NULL | open, dept=Sala de espera IA, assigned=NULL | open, **dept=Vendas, assigned=Waleska** |
| `2bd8c770` | VENDAS 02 disconnected | open, dept=Vendas, assigned=Waleska | **closed**, dept=Vendas, assigned=Waleska | closed (intacto) |

Waleska Brum (vendedora, dept Vendas) volta a ver a conv em API_Oficial via RLS policy `assigned_to = auth.uid()`. Sem necessidade de "trocar canal" — abre direto.

## Pendências (não bloqueantes)

1. **35 contatos residuais não-padrão-Adriano** — todos open em canais all-disconnected (sem alternativa connected) ou 2 canais connected coexistindo (ex.: API_Oficial + Vendas 06). Decisão de produto: caso a caso.
2. **Camada 3 frontend**: filtrar canais `disconnected`/`is_deleted` no `MultipleConversationsModal` e nos dropdowns de "trocar canal". Cosmético.
3. **Camada 4 monitoring**: cron diário contando órfãs novas; alertar se > N/dia.
4. **Auditar `whatsapp-webhook` v501** (Evolution): redundante com triggers — fazer se quiser belt-and-suspenders.

## Operacional pra Waleska / atendentes

- **Atualizar página (Ctrl+F5)** depois do deploy pra invalidar cache.
- **Janela 24h da API Oficial**: a conv `2c08cb83` tem última msg do cliente em 21/03/2026. Pra mandar mensagem agora (46 dias depois), atendente deve usar **template aprovado**, não texto livre.
