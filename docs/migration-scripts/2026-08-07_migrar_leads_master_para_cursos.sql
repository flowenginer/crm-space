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
--     - as TAGS usadas por esses leads (criadas no tenant novo por nome,
--       se ainda não existirem lá, e re-vinculadas)
--     - os STATUS (lead_statuses) usados por esses leads (criados no
--       tenant novo por nome, se ainda não existirem lá; o texto em
--       contacts.lead_status / conversations.lead_status é mantido)
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
  -- 3. TAGS: garantir equivalentes (por nome) no tenant novo
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

  INSERT INTO public.tags (tenant_id, name, color, visibility, department_id, order_position)
  SELECT v_new_tenant, tm.name, tm.color, tm.visibility,
         CASE WHEN tm.old_department_id = v_old_dept THEN v_new_dept ELSE NULL END,
         COALESCE((SELECT MAX(order_position) FROM public.tags WHERE tenant_id = v_new_tenant), 0)
           + ROW_NUMBER() OVER (ORDER BY tm.name)
  FROM _tag_map tm
  WHERE NOT EXISTS (
    SELECT 1 FROM public.tags nt WHERE nt.tenant_id = v_new_tenant AND nt.name = tm.name
  );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Tags novas criadas no Tenant Master Cursos: %', v_count;

  CREATE TEMP TABLE _tag_id_map ON COMMIT DROP AS
  SELECT tm.old_tag_id,
         (SELECT nt.id FROM public.tags nt
          WHERE nt.tenant_id = v_new_tenant AND nt.name = tm.name
          ORDER BY nt.id LIMIT 1) AS new_tag_id
  FROM _tag_map tm;

  -- ==========================================================
  -- 4. STATUS: garantir que os lead_statuses usados existam no tenant novo
  --    (contacts.lead_status / conversations.lead_status são texto livre
  --    e continuam com o mesmo valor — só precisamos ter o "cartão" de
  --    status correspondente no tenant novo)
  -- ==========================================================
  INSERT INTO public.lead_statuses (tenant_id, name, color, order_position, is_active)
  SELECT v_new_tenant, s.name, s.color,
         COALESCE((SELECT MAX(order_position) FROM public.lead_statuses WHERE tenant_id = v_new_tenant), 0)
           + ROW_NUMBER() OVER (ORDER BY s.order_position),
         true
  FROM (
    SELECT DISTINCT ls.name, ls.color, ls.order_position
    FROM public.lead_statuses ls
    WHERE ls.tenant_id = v_old_tenant
      AND ls.name IN (
        SELECT c.lead_status FROM public.contacts c
        WHERE c.id IN (SELECT contact_id FROM _migrating_contacts) AND c.lead_status IS NOT NULL
        UNION
        SELECT cv.lead_status FROM public.conversations cv
        WHERE cv.id IN (SELECT conversation_id FROM _migrating_conversations) AND cv.lead_status IS NOT NULL
      )
  ) s
  WHERE NOT EXISTS (
    SELECT 1 FROM public.lead_statuses nls WHERE nls.tenant_id = v_new_tenant AND nls.name = s.name
  );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Status novos criados no Tenant Master Cursos: %', v_count;

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
