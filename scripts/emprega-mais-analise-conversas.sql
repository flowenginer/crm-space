-- ============================================================
-- ANÁLISE DE CONVERSAS — TENANT "MASTER" / CANAL "EMPREGA MAIS"
-- Execute no Supabase Cloud > SQL Editor (Run SQL)
-- Rode UMA query por vez (cada bloco "QUERY n" devolve um resultado).
--
-- Definições usadas:
--   • "agendado"            = lead_status (estágio do funil) cujo nome contém "agend"
--   • "não receberam resposta" = first_response_at IS NULL (nunca tivemos NENHUMA resposta nossa)
--   • "sem responder"       = conversa ABERTA, última mensagem é do CLIENTE
--                             (last_message_is_from_me = false) -> aguardando nós AGORA
-- ============================================================


-- ============================================================
-- QUERY 0 — CONFIRMAR TENANT E CANAIS (rode primeiro!)
-- Verifique se o tenant/canais resolvidos abaixo são os corretos.
-- Se houver mais de um tenant "master" ou canal "emprega", ajuste os filtros.
-- ============================================================
SELECT 'TENANT' AS tipo, t.id, t.name, t.slug, t.created_at
FROM tenants t
WHERE t.name ILIKE '%master%'
UNION ALL
SELECT 'CANAL' AS tipo, ch.id, ch.name, ch.phone, ch.created_at
FROM whatsapp_channels ch
WHERE ch.tenant_id IN (SELECT id FROM tenants WHERE name ILIKE '%master%')
  AND ch.name ILIKE '%emprega%'
ORDER BY tipo, name;


-- ============================================================
-- QUERY 1 — RESUMO GERAL (uma linha com todos os números-chave)
-- ============================================================
WITH params AS (
  SELECT
    (SELECT id FROM tenants WHERE name ILIKE '%master%' ORDER BY created_at LIMIT 1) AS tenant_id
),
canais AS (
  SELECT id FROM whatsapp_channels
  WHERE tenant_id = (SELECT tenant_id FROM params)
    AND name ILIKE '%emprega%'
),
conv AS (
  SELECT c.*, ct.lead_status AS contact_lead_status, ct.full_name, ct.phone
  FROM conversations c
  JOIN contacts ct ON ct.id = c.contact_id
  WHERE c.tenant_id = (SELECT tenant_id FROM params)
    AND c.channel_id IN (SELECT id FROM canais)
)
SELECT
  COUNT(*)                                                                       AS total_conversas,
  COUNT(*) FILTER (WHERE status = 'open')                                        AS abertas,
  COUNT(*) FILTER (WHERE status = 'closed')                                      AS fechadas,
  COUNT(*) FILTER (WHERE status NOT IN ('open','closed') OR status IS NULL)      AS outros_status,
  -- Agendados (pelo funil do contato OU da conversa)
  COUNT(*) FILTER (WHERE contact_lead_status ILIKE '%agend%'
                      OR lead_status ILIKE '%agend%')                            AS agendados,
  COUNT(*) FILTER (WHERE COALESCE(contact_lead_status,'') NOT ILIKE '%agend%'
                     AND COALESCE(lead_status,'')         NOT ILIKE '%agend%')   AS nao_agendados,
  -- Nunca receberam resposta nossa
  COUNT(*) FILTER (WHERE first_response_at IS NULL)                              AS nunca_responderam,
  COUNT(*) FILTER (WHERE first_response_at IS NOT NULL)                          AS ja_responderam,
  -- Aguardando nossa resposta AGORA (abertas, última msg do cliente)
  COUNT(*) FILTER (WHERE status = 'open'
                     AND COALESCE(last_message_is_from_me, false) = false)       AS aguardando_nossa_resposta,
  -- Leads frios: nós falamos por último e cliente nunca devolveu (abertas)
  COUNT(*) FILTER (WHERE status = 'open'
                     AND last_message_is_from_me = true)                         AS cliente_nao_respondeu
FROM conv;


-- ============================================================
-- QUERY 2 — AGENDADOS x NÃO AGENDADOS, detalhado por estágio do funil
-- ============================================================
WITH params AS (
  SELECT (SELECT id FROM tenants WHERE name ILIKE '%master%' ORDER BY created_at LIMIT 1) AS tenant_id
),
canais AS (
  SELECT id FROM whatsapp_channels
  WHERE tenant_id = (SELECT tenant_id FROM params) AND name ILIKE '%emprega%'
)
SELECT
  COALESCE(ct.lead_status, '(sem status)')                          AS estagio_funil,
  CASE WHEN ct.lead_status ILIKE '%agend%' THEN 'AGENDADO'
       ELSE 'não agendado' END                                      AS classificacao,
  COUNT(*)                                                          AS qtd_conversas
FROM conversations c
JOIN contacts ct ON ct.id = c.contact_id
WHERE c.tenant_id = (SELECT tenant_id FROM params)
  AND c.channel_id IN (SELECT id FROM canais)
GROUP BY 1, 2
ORDER BY classificacao DESC, qtd_conversas DESC;


-- ============================================================
-- QUERY 3 — STATUS DE RESPOSTA (sem responder x não respondidos x respondidas)
-- ============================================================
WITH params AS (
  SELECT (SELECT id FROM tenants WHERE name ILIKE '%master%' ORDER BY created_at LIMIT 1) AS tenant_id
),
canais AS (
  SELECT id FROM whatsapp_channels
  WHERE tenant_id = (SELECT tenant_id FROM params) AND name ILIKE '%emprega%'
)
SELECT
  CASE
    WHEN first_response_at IS NULL AND COALESCE(last_message_is_from_me,false) = false
      THEN '1) NUNCA respondida — cliente esperando (nunca tocada)'
    WHEN first_response_at IS NULL AND last_message_is_from_me = true
      THEN '2) Só mensagem automática/nossa — cliente nunca devolveu'
    WHEN status = 'open' AND COALESCE(last_message_is_from_me,false) = false
      THEN '3) Já respondida antes, mas AGUARDANDO nós agora'
    WHEN status = 'open' AND last_message_is_from_me = true
      THEN '4) Aberta — bola com o cliente'
    WHEN status = 'closed'
      THEN '5) Encerrada'
    ELSE '6) Outro'
  END                                              AS situacao,
  COUNT(*)                                         AS qtd
FROM conversations c
WHERE c.tenant_id = (SELECT tenant_id FROM params)
  AND c.channel_id IN (SELECT id FROM canais)
GROUP BY 1
ORDER BY 1;


-- ============================================================
-- QUERY 4 — POR ATENDENTE (carga e desfecho)
-- ============================================================
WITH params AS (
  SELECT (SELECT id FROM tenants WHERE name ILIKE '%master%' ORDER BY created_at LIMIT 1) AS tenant_id
),
canais AS (
  SELECT id FROM whatsapp_channels
  WHERE tenant_id = (SELECT tenant_id FROM params) AND name ILIKE '%emprega%'
)
SELECT
  COALESCE(p.full_name, p.email, '(sem atendente)')                     AS atendente,
  COUNT(*)                                                              AS total,
  COUNT(*) FILTER (WHERE ct.lead_status ILIKE '%agend%')                AS agendados,
  COUNT(*) FILTER (WHERE c.first_response_at IS NULL)                   AS nunca_respondidas,
  COUNT(*) FILTER (WHERE c.status = 'open'
                     AND COALESCE(c.last_message_is_from_me,false)=false) AS aguardando_resposta,
  COUNT(*) FILTER (WHERE c.status = 'closed')                           AS encerradas
FROM conversations c
JOIN contacts ct ON ct.id = c.contact_id
LEFT JOIN profiles p ON p.id = c.assigned_to
WHERE c.tenant_id = (SELECT tenant_id FROM params)
  AND c.channel_id IN (SELECT id FROM canais)
GROUP BY 1
ORDER BY total DESC;


-- ============================================================
-- QUERY 5 — DESFECHOS DAS CONVERSAS ENCERRADAS (motivo de fechamento)
-- ============================================================
WITH params AS (
  SELECT (SELECT id FROM tenants WHERE name ILIKE '%master%' ORDER BY created_at LIMIT 1) AS tenant_id
),
canais AS (
  SELECT id FROM whatsapp_channels
  WHERE tenant_id = (SELECT tenant_id FROM params) AND name ILIKE '%emprega%'
)
SELECT
  COALESCE(close_reason, '(sem motivo registrado)')   AS motivo_fechamento,
  COUNT(*)                                            AS qtd
FROM conversations c
WHERE c.tenant_id = (SELECT tenant_id FROM params)
  AND c.channel_id IN (SELECT id FROM canais)
  AND c.status = 'closed'
GROUP BY 1
ORDER BY qtd DESC;


-- ============================================================
-- QUERY 6 — EXPORT DE TRANSCRIÇÕES COMPLETAS (para análise qualitativa)
-- Devolve TODA mensagem de TODAS as conversas, em ordem cronológica.
-- Exporte como CSV/JSON e me envie para eu analisar "o que foi dito,
-- o que não foi dito e as tomadas de decisão".
-- (Para uma conversa específica, descomente o filtro do contato no fim.)
-- ============================================================
WITH params AS (
  SELECT (SELECT id FROM tenants WHERE name ILIKE '%master%' ORDER BY created_at LIMIT 1) AS tenant_id
),
canais AS (
  SELECT id FROM whatsapp_channels
  WHERE tenant_id = (SELECT tenant_id FROM params) AND name ILIKE '%emprega%'
)
SELECT
  ct.full_name                                            AS contato,
  ct.phone                                                AS telefone,
  ct.lead_status                                          AS estagio_funil,
  c.status                                                AS status_conversa,
  c.id                                                    AS conversation_id,
  m.created_at                                            AS quando,
  CASE WHEN m.is_from_me THEN 'EMPRESA' ELSE 'CLIENTE' END AS quem,
  m.message_type                                          AS tipo,
  COALESCE(m.content, m.transcription, '['||m.message_type||']') AS mensagem
FROM conversations c
JOIN contacts ct ON ct.id = c.contact_id
JOIN messages  m ON m.conversation_id = c.id
WHERE c.tenant_id = (SELECT tenant_id FROM params)
  AND c.channel_id IN (SELECT id FROM canais)
  AND COALESCE(m.is_deleted, false) = false
  -- AND ct.phone = '5521999999999'   -- <- descomente para uma conversa só
ORDER BY ct.full_name, c.id, m.created_at;
