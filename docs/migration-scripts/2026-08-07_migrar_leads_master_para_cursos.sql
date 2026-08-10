-- ============================================================
-- MIGRAÇÃO DE LEADS: Tenant Master -> Tenant Master Cursos
-- ============================================================
-- Execute este script no Supabase SQL Editor
-- Data: 2026-08-07
-- Solicitante: infra@altislisboa.com.br
--
-- OBJETIVO
--   Mover para o Tenant Master Cursos todos os leads (contacts) que
--   hoje estão no Tenant Master, no Departamento "Master Leads" e
--   têm conversa no canal WhatsApp informado, reatribuindo cada lead
--   ao profile equivalente no tenant novo (Susana/Bruna/Nathalia/
--   Sandra), e levando junto:
--     - conversas e mensagens desses leads (trocando tenant/depto/canal)
--     - as TAGS usadas por esses leads: reaproveita se já existir uma
--       tag com esse nome no tenant novo; "muda de dono" a tag em si
--       quando ela só é usada pelos leads migrados; e só duplica (com
--       sufixo " (Cursos)") quando a tag é compartilhada com leads que
--       ficam no tenant antigo — a tabela tags tem um nome ÚNICO GLOBAL
--       (constraint tags_name_key), então não dá pra simplesmente criar
--       uma cópia com o mesmo nome em outro tenant
--     - os STATUS (lead_statuses) usados por esses leads, com a mesma
--       lógica (reaproveita / muda de dono / duplica com sufixo se
--       necessário); o texto em contacts.lead_status /
--       conversations.lead_status é mantido como está
--     - o histórico (lead_status_history, lead_assignment_history,
--       conversation_events) para não sumir da timeline do lead
--
--   Leads do filtro que estejam atribuídos a alguém fora do mapa de
--   profiles abaixo são migrados normalmente, mantendo o assigned_to
--   como está (não são remapeados nem excluídos).
--
-- ANTES DE EXECUTAR
--   1. Faça backup/snapshot do banco.
--   2. Rode a query de PRÉ-CHECAGEM abaixo e confira se os números
--      batem com o que você espera.
--   3. Execute o bloco principal (já dentro de uma transação). Ele
--      aborta sozinho (RAISE EXCEPTION) se algum UUID não existir ou
--      se nenhum lead for encontrado.
--   4. Confira as queries de VERIFICAÇÃO no final.
--   5. Só então descomente o COMMIT. Se algo parecer errado, rode
--      ROLLBACK.
-- ============================================================

-- ------------------------------------------------------------
-- PRÉ-CHECAGEM (rode antes, fora da transação — apenas leitura)
-- ------------------------------------------------------------
-- 1) Quantos leads o filtro pega hoje:
-- SELECT COUNT(DISTINCT c.id)
-- FROM public.contacts c
-- WHERE c.tenant_id = '664dfcb4-5432-4c14-9838-7db14360cabf'
--   AND c.department_id = '40d7cfb7-e26c-4fa0-9ad0-199e0b3b2789'
--   AND EXISTS (
--     SELECT 1 FROM public.conversations cv
--     WHERE cv.contact_id = c.id
--       AND cv.tenant_id = '664dfcb4-5432-4c14-9838-7db14360cabf'
--       AND cv.channel_id = '04bf2c88-8418-40b6-b678-f746bc879041'
--   );
--
-- 2) Checar se existem tags com nome duplicado no tenant antigo
--    (isso pode causar conflito ao repassar contact_tags/conversation_tags):
-- SELECT name, COUNT(*) FROM public.tags
-- WHERE tenant_id = '664dfcb4-5432-4c14-9838-7db14360cabf'
-- GROUP BY name HAVING COUNT(*) > 1;
--
-- 3) Conferir constraints de nome único em tags/lead_statuses (a tabela
--    tags JÁ TEM uma constraint de nome único global — tratada no script;
--    isso é só pra você ver o que existe):
-- SELECT conrelid::regclass AS tabela, conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid IN ('public.tags'::regclass, 'public.lead_statuses'::regclass)
--   AND contype = 'u';
-- ------------------------------------------------------------

BEGIN;

DO $$
DECLARE
  -- Origem
  v_old_tenant   UUID := '664dfcb4-5432-4c14-9838-7db14360cabf'; -- Tenant Master
  v_old_dept     UUID := '40d7cfb7-e26c-4fa0-9ad0-199e0b3b2789'; -- Departamento Master Leads
  v_old_channel  UUID := '04bf2c88-8418-40b6-b678-f746bc879041'; -- Channel antigo

  -- Destino
  v_new_tenant   UUID := '5a483957-a680-4f56-a5f3-d3bb252754ff'; -- Tenant Master Cursos
  v_new_dept     UUID := '5d876b63-781b-4b8e-835a-5bd8a6bcd934'; -- Departamento no tenant novo
  v_new_channel  UUID := 'c4547621-8935-42c9-bb5d-aa0419331857'; -- Channel novo

  v_count INTEGER;
BEGIN

  -- ==========================================================
  -- 0. VALIDAÇÃO DOS IDs (aborta tudo se algo não existir)
  -- ==========================================================
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = v_old_tenant) THEN
    RAISE EXCEPTION 'Tenant Master (%) não encontrado', v_old_tenant;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = v_new_tenant) THEN
    RAISE EXCEPTION 'Tenant Master Cursos (%) não encontrado', v_new_tenant;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.departments WHERE id = v_old_dept AND tenant_id = v_old_tenant) THEN
    RAISE EXCEPTION 'Departamento Master Leads (%) não encontrado no Tenant Master', v_old_dept;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.departments WHERE id = v_new_dept AND tenant_id = v_new_tenant) THEN
    RAISE EXCEPTION 'Departamento de destino (%) não encontrado no Tenant Master Cursos', v_new_dept;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.whatsapp_channels WHERE id = v_old_channel AND tenant_id = v_old_tenant) THEN
    RAISE EXCEPTION 'Channel antigo (%) não encontrado no Tenant Master', v_old_channel;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.whatsapp_channels WHERE id = v_new_channel AND tenant_id = v_new_tenant) THEN
    RAISE EXCEPTION 'Channel novo (%) não encontrado no Tenant Master Cursos', v_new_channel;
  END IF;

  -- ==========================================================
  -- 1. MAPA DE PROFILES (antigo -> novo)
  -- ==========================================================
  CREATE TEMP TABLE _profile_map (old_id UUID, new_id UUID) ON COMMIT DROP;
  INSERT INTO _profile_map (old_id, new_id) VALUES
    ('f3ed2384-998e-40d5-9056-2a73b46ffde3', '50d027c8-2a64-4be4-ab82-1cff40dd07a5'), -- Susana
    ('6d25c3fd-0c3e-4e59-bfee-faad61abdc8d', 'b314803f-28f6-409f-a9d7-69748d2d9a05'), -- Bruna
    ('ecd7549a-ae12-4fe6-8fd1-8d50843f3bbe', '3e0e64e9-7d81-45de-a7ca-d6f5cc9eb72f'), -- Nathalia
    ('1e4bf596-e9bb-4704-b39d-7553ab80e852', 'f96dd63e-b0f6-4311-9fee-7b39f290e120'); -- Sandra

  IF EXISTS (
    SELECT 1 FROM _profile_map pm
    WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = pm.old_id)
       OR NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = pm.new_id AND p.tenant_id = v_new_tenant)
  ) THEN
    RAISE EXCEPTION 'Algum profile do mapa antigo/novo não existe (ou o novo não pertence ao Tenant Master Cursos). Confira os IDs.';
  END IF;

  -- ==========================================================
  -- 2. LEADS ALVO DA MIGRAÇÃO
  -- ==========================================================
  CREATE TEMP TABLE _migrating_contacts ON COMMIT DROP AS
  SELECT DISTINCT c.id AS contact_id
  FROM public.contacts c
  WHERE c.tenant_id = v_old_tenant
    AND c.department_id = v_old_dept
    AND EXISTS (
      SELECT 1 FROM public.conversations cv
      WHERE cv.contact_id = c.id
        AND cv.tenant_id = v_old_tenant
        AND cv.channel_id = v_old_channel
    );

  SELECT COUNT(*) INTO v_count FROM _migrating_contacts;
  RAISE NOTICE 'Leads identificados para migração: %', v_count;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'Nenhum lead encontrado com esse filtro (tenant/departamento/canal). Abortando.';
  END IF;

  CREATE TEMP TABLE _migrating_conversations ON COMMIT DROP AS
  SELECT cv.id AS conversation_id
  FROM public.conversations cv
  WHERE cv.tenant_id = v_old_tenant
    AND cv.contact_id IN (SELECT contact_id FROM _migrating_contacts);

  SELECT COUNT(*) INTO v_count FROM _migrating_conversations;
  RAISE NOTICE 'Conversas vinculadas a esses leads: %', v_count;

  -- ==========================================================
  -- 3. TAGS
  --    IMPORTANTE: a tabela public.tags tem uma constraint de nome
  --    ÚNICO GLOBAL (tags_name_key) — não dá pra existir duas tags
  --    com o mesmo nome em tenants diferentes. Por isso NÃO criamos
  --    uma cópia "solta" por padrão; a estratégia é:
  --      a) já existe tag com esse nome no tenant novo -> reaproveita
  --      b) a tag só é usada pelos leads que estão migrando (nenhum
  --         outro lead do tenant antigo usa) -> "muda de dono": a
  --         própria linha de tags passa a pertencer ao tenant novo
  --      c) a tag é compartilhada com leads que NÃO estão migrando
  --         -> não dá pra mover (quebraria quem fica) nem duplicar
  --         com o mesmo nome (constraint); cria uma cópia com sufixo
  --         " (Cursos)" no tenant novo e usa essa cópia pros leads
  --         migrados
  -- ==========================================================
  CREATE TEMP TABLE _tag_map ON COMMIT DROP AS
  SELECT DISTINCT old_t.id AS old_tag_id, old_t.name, old_t.color, old_t.visibility,
         old_t.department_id AS old_department_id
  FROM public.tags old_t
  WHERE old_t.tenant_id = v_old_tenant
    AND old_t.id IN (
      SELECT ct.tag_id FROM public.contact_tags ct
      WHERE ct.tenant_id = v_old_tenant
        AND ct.contact_id IN (SELECT contact_id FROM _migrating_contacts)
      UNION
      SELECT cvt.tag_id FROM public.conversation_tags cvt
      WHERE cvt.tenant_id = v_old_tenant
        AND cvt.conversation_id IN (SELECT conversation_id FROM _migrating_conversations)
    );

  SELECT COUNT(*) INTO v_count FROM _tag_map;
  RAISE NOTICE 'Tags distintas em uso pelos leads migrados: %', v_count;

  -- Mapa final old_tag_id -> new_tag_id. Por padrão mantém o mesmo id
  -- (cobre o caso "b", onde a tag muda de dono mas o id não muda).
  CREATE TEMP TABLE _tag_id_map ON COMMIT DROP AS
  SELECT tm.old_tag_id, tm.old_tag_id AS new_tag_id
  FROM _tag_map tm;

  -- (a) já existe tag com esse nome no tenant novo -> reaproveita o id dela
  UPDATE _tag_id_map tim
  SET new_tag_id = existing.id
  FROM _tag_map tm
  JOIN public.tags existing
    ON existing.tenant_id = v_new_tenant AND existing.name = tm.name
  WHERE tim.old_tag_id = tm.old_tag_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Tags reaproveitadas (já existiam com esse nome no tenant novo): %', v_count;

  -- (b) tag de uso exclusivo dos leads migrados -> muda de dono (UPDATE na própria linha)
  CREATE TEMP TABLE _tags_to_move ON COMMIT DROP AS
  SELECT tm.old_tag_id, tm.old_department_id
  FROM _tag_map tm
  WHERE tm.old_tag_id NOT IN (SELECT old_tag_id FROM _tag_id_map WHERE new_tag_id <> old_tag_id) -- não caiu no caso (a)
    AND NOT EXISTS (
      SELECT 1 FROM public.contact_tags ct
      WHERE ct.tag_id = tm.old_tag_id
        AND ct.contact_id NOT IN (SELECT contact_id FROM _migrating_contacts)
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.conversation_tags cvt
      WHERE cvt.tag_id = tm.old_tag_id
        AND cvt.conversation_id NOT IN (SELECT conversation_id FROM _migrating_conversations)
    );

  UPDATE public.tags t
  SET tenant_id = v_new_tenant,
      department_id = CASE WHEN t.department_id = v_old_dept THEN v_new_dept ELSE t.department_id END
  FROM _tags_to_move ttm
  WHERE t.id = ttm.old_tag_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Tags movidas para o Tenant Master Cursos (uso exclusivo dos leads migrados): %', v_count;

  -- (c) sobrou: compartilhada com leads que não migram -> duplica com sufixo
  CREATE TEMP TABLE _tags_shared ON COMMIT DROP AS
  SELECT tm.old_tag_id, tm.name, tm.color, tm.visibility, tm.old_department_id
  FROM _tag_map tm
  WHERE tm.old_tag_id NOT IN (SELECT old_tag_id FROM _tags_to_move)
    AND tm.old_tag_id IN (SELECT old_tag_id FROM _tag_id_map WHERE new_tag_id = old_tag_id); -- não resolvida em (a) nem (b)

  INSERT INTO public.tags (tenant_id, name, color, visibility, department_id, order_position)
  SELECT v_new_tenant,
         CASE
           WHEN NOT EXISTS (SELECT 1 FROM public.tags x WHERE x.name = ts.name || ' (Cursos)')
             THEN ts.name || ' (Cursos)'
           ELSE ts.name || ' (Cursos ' || substr(ts.old_tag_id::text, 1, 8) || ')'
         END,
         ts.color, ts.visibility,
         CASE WHEN ts.old_department_id = v_old_dept THEN v_new_dept ELSE NULL END,
         COALESCE((SELECT MAX(order_position) FROM public.tags WHERE tenant_id = v_new_tenant), 0)
           + ROW_NUMBER() OVER (ORDER BY ts.name)
  FROM _tags_shared ts;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN
    RAISE NOTICE 'ATENÇÃO: % tag(s) compartilhadas com leads que NÃO migraram — como o nome é único no sistema, foi criada uma cópia com sufixo "(Cursos)" no tenant novo: %',
      v_count, (SELECT string_agg(name, ', ') FROM _tags_shared);
  END IF;

  UPDATE _tag_id_map tim
  SET new_tag_id = created.id
  FROM _tags_shared ts
  JOIN public.tags created
    ON created.tenant_id = v_new_tenant
   AND (created.name = ts.name || ' (Cursos)' OR created.name = ts.name || ' (Cursos ' || substr(ts.old_tag_id::text, 1, 8) || ')')
  WHERE tim.old_tag_id = ts.old_tag_id;

  -- ==========================================================
  -- 4. STATUS (lead_statuses)
  --    contacts.lead_status / conversations.lead_status são texto
  --    livre (não têm FK) e o valor é mantido como está; aqui só
  --    garantimos que exista o "cartão" de status correspondente no
  --    tenant novo, usando a mesma estratégia de mover-se-exclusivo /
  --    reaproveitar-se-já-existir da seção de tags (por segurança,
  --    caso lead_statuses também tenha alguma constraint de nome).
  -- ==========================================================
  CREATE TEMP TABLE _status_map ON COMMIT DROP AS
  SELECT DISTINCT ls.id AS old_status_id, ls.name, ls.color, ls.order_position
  FROM public.lead_statuses ls
  WHERE ls.tenant_id = v_old_tenant
    AND ls.name IN (
      SELECT c.lead_status FROM public.contacts c
      WHERE c.id IN (SELECT contact_id FROM _migrating_contacts) AND c.lead_status IS NOT NULL
      UNION
      SELECT cv.lead_status FROM public.conversations cv
      WHERE cv.id IN (SELECT conversation_id FROM _migrating_conversations) AND cv.lead_status IS NOT NULL
    );

  SELECT COUNT(*) INTO v_count FROM _status_map;
  RAISE NOTICE 'Status distintos em uso pelos leads migrados: %', v_count;

  -- (a) já existe status com esse nome no tenant novo -> nada a fazer
  -- (b) status de uso exclusivo dos leads migrados -> muda de dono
  CREATE TEMP TABLE _status_to_move ON COMMIT DROP AS
  SELECT sm.old_status_id
  FROM _status_map sm
  WHERE NOT EXISTS (SELECT 1 FROM public.lead_statuses x WHERE x.tenant_id = v_new_tenant AND x.name = sm.name)
    AND NOT EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.tenant_id = v_old_tenant AND c.lead_status = sm.name
        AND c.id NOT IN (SELECT contact_id FROM _migrating_contacts)
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.conversations cv
      WHERE cv.tenant_id = v_old_tenant AND cv.lead_status = sm.name
        AND cv.id NOT IN (SELECT conversation_id FROM _migrating_conversations)
    );

  UPDATE public.lead_statuses ls
  SET tenant_id = v_new_tenant
  WHERE ls.id IN (SELECT old_status_id FROM _status_to_move);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Status movidos para o Tenant Master Cursos (uso exclusivo dos leads migrados): %', v_count;

  -- (c) sobrou: compartilhado com leads que não migram -> tenta criar com
  --     o mesmo nome; se houver alguma constraint de nome único (como em
  --     tags), cai no fallback com sufixo "(Cursos)"
  BEGIN
    INSERT INTO public.lead_statuses (tenant_id, name, color, order_position, is_active)
    SELECT v_new_tenant, sm.name, sm.color,
           COALESCE((SELECT MAX(order_position) FROM public.lead_statuses WHERE tenant_id = v_new_tenant), 0)
             + ROW_NUMBER() OVER (ORDER BY sm.order_position),
           true
    FROM _status_map sm
    WHERE sm.old_status_id NOT IN (SELECT old_status_id FROM _status_to_move)
      AND NOT EXISTS (SELECT 1 FROM public.lead_statuses x WHERE x.tenant_id = v_new_tenant AND x.name = sm.name);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE 'Status compartilhados duplicados com o mesmo nome no Tenant Master Cursos: %', v_count;
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'ATENÇÃO: nome de status já existe em outro tenant (constraint única) — criando com sufixo "(Cursos)".';
    INSERT INTO public.lead_statuses (tenant_id, name, color, order_position, is_active)
    SELECT v_new_tenant, sm.name || ' (Cursos)', sm.color,
           COALESCE((SELECT MAX(order_position) FROM public.lead_statuses WHERE tenant_id = v_new_tenant), 0)
             + ROW_NUMBER() OVER (ORDER BY sm.order_position),
           true
    FROM _status_map sm
    WHERE sm.old_status_id NOT IN (SELECT old_status_id FROM _status_to_move)
      AND NOT EXISTS (SELECT 1 FROM public.lead_statuses x WHERE x.tenant_id = v_new_tenant AND x.name = sm.name || ' (Cursos)');
  END;

  -- ==========================================================
  -- 5. MIGRAÇÃO DOS LEADS (contacts)
  -- ==========================================================
  UPDATE public.contacts c
  SET tenant_id = v_new_tenant,
      department_id = v_new_dept,
      assigned_to = COALESCE(
        (SELECT pm.new_id FROM _profile_map pm WHERE pm.old_id = c.assigned_to),
        c.assigned_to
      ),
      updated_at = now()
  WHERE c.id IN (SELECT contact_id FROM _migrating_contacts);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'contacts migrados: %', v_count;

  -- ==========================================================
  -- 6. CONVERSAS E MENSAGENS
  -- ==========================================================
  UPDATE public.conversations cv
  SET tenant_id = v_new_tenant,
      department_id = v_new_dept,
      channel_id = CASE WHEN cv.channel_id = v_old_channel THEN v_new_channel ELSE cv.channel_id END,
      assigned_to = COALESCE(
        (SELECT pm.new_id FROM _profile_map pm WHERE pm.old_id = cv.assigned_to),
        cv.assigned_to
      ),
      updated_at = now()
  WHERE cv.id IN (SELECT conversation_id FROM _migrating_conversations);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'conversations migradas: %', v_count;

  UPDATE public.messages m
  SET tenant_id = v_new_tenant
  WHERE m.conversation_id IN (SELECT conversation_id FROM _migrating_conversations);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'messages migradas: %', v_count;

  -- ==========================================================
  -- 7. REVINCULAR TAGS (contact_tags / conversation_tags)
  -- ==========================================================
  UPDATE public.contact_tags ct
  SET tag_id = tim.new_tag_id,
      tenant_id = v_new_tenant
  FROM _tag_id_map tim
  WHERE ct.tenant_id = v_old_tenant
    AND ct.contact_id IN (SELECT contact_id FROM _migrating_contacts)
    AND ct.tag_id = tim.old_tag_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'contact_tags revinculadas: %', v_count;

  UPDATE public.conversation_tags cvt
  SET tag_id = tim.new_tag_id,
      tenant_id = v_new_tenant
  FROM _tag_id_map tim
  WHERE cvt.tenant_id = v_old_tenant
    AND cvt.conversation_id IN (SELECT conversation_id FROM _migrating_conversations)
    AND cvt.tag_id = tim.old_tag_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'conversation_tags revinculadas: %', v_count;

  -- ==========================================================
  -- 8. HISTÓRICO (não deixar sumir da timeline do lead)
  -- ==========================================================
  UPDATE public.lead_status_history lsh
  SET tenant_id = v_new_tenant
  WHERE lsh.contact_id IN (SELECT contact_id FROM _migrating_contacts);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'lead_status_history migrado: %', v_count;

  UPDATE public.lead_assignment_history lah
  SET tenant_id = v_new_tenant
  WHERE lah.contact_id IN (SELECT contact_id FROM _migrating_contacts);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'lead_assignment_history migrado: %', v_count;

  UPDATE public.conversation_events ce
  SET tenant_id = v_new_tenant
  WHERE ce.conversation_id IN (SELECT conversation_id FROM _migrating_conversations);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'conversation_events migrado: %', v_count;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'MIGRAÇÃO CONCLUÍDA (dentro da transação — confira e dê COMMIT)';
  RAISE NOTICE '========================================';

END $$;

-- ==========================================================
-- VERIFICAÇÃO PÓS-MIGRAÇÃO (ainda dentro da transação)
-- ==========================================================

-- Não deve sobrar nenhum lead no filtro antigo:
SELECT COUNT(*) AS leads_restantes_no_filtro_antigo
FROM public.contacts c
WHERE c.tenant_id = '664dfcb4-5432-4c14-9838-7db14360cabf'
  AND c.department_id = '40d7cfb7-e26c-4fa0-9ad0-199e0b3b2789'
  AND EXISTS (
    SELECT 1 FROM public.conversations cv
    WHERE cv.contact_id = c.id
      AND cv.tenant_id = '664dfcb4-5432-4c14-9838-7db14360cabf'
      AND cv.channel_id = '04bf2c88-8418-40b6-b678-f746bc879041'
  );

-- Distribuição por responsável no tenant novo, dentro do canal novo:
SELECT p.full_name, COUNT(*) AS leads
FROM public.contacts c
LEFT JOIN public.profiles p ON p.id = c.assigned_to
WHERE c.tenant_id = '5a483957-a680-4f56-a5f3-d3bb252754ff'
  AND c.department_id = '5d876b63-781b-4b8e-835a-5bd8a6bcd934'
GROUP BY p.full_name
ORDER BY leads DESC;

-- Conversas no canal novo:
SELECT COUNT(*) AS conversas_no_canal_novo
FROM public.conversations
WHERE tenant_id = '5a483957-a680-4f56-a5f3-d3bb252754ff'
  AND channel_id = 'c4547621-8935-42c9-bb5d-aa0419331857';

-- Tags e status disponíveis agora no Tenant Master Cursos:
SELECT id, name, department_id FROM public.tags WHERE tenant_id = '5a483957-a680-4f56-a5f3-d3bb252754ff' ORDER BY name;
SELECT id, name, order_position FROM public.lead_statuses WHERE tenant_id = '5a483957-a680-4f56-a5f3-d3bb252754ff' ORDER BY order_position;

-- ==========================================================
-- SE TUDO ESTIVER OK, EXECUTE:
-- COMMIT;
--
-- SE ALGO DEU ERRADO, EXECUTE:
-- ROLLBACK;
-- ==========================================================

-- Descomente a linha abaixo para confirmar:
-- COMMIT;
