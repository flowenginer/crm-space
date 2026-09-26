-- Corrige conversas/mensagens criadas por disparo em massa no tenant errado.
--
-- Causa: process-bulk-dispatch criava conversas sem tenant_id. Como a edge
-- function roda como service_role, o trigger auto_set_tenant_id preenchia o
-- tenant padrão (00000000-0000-0000-0000-000000000001) e a conversa sumia da
-- lista de Conversas do tenant do disparo.
--
-- Fonte da verdade: tenant_id do contato (dono da conversa).
-- Rode primeiro o SELECT de diagnóstico, depois o bloco de UPDATE.

-- 1) Diagnóstico
SELECT bd.id AS dispatch_id, bd.name AS dispatch, bd.campaign_type,
       count(DISTINCT c.id) AS conversas_no_tenant_errado
FROM bulk_dispatch_contacts bdc
JOIN bulk_dispatches bd ON bd.id = bdc.dispatch_id
JOIN conversations c ON c.id = bdc.conversation_id
JOIN contacts ct ON ct.id = c.contact_id
WHERE c.tenant_id IS DISTINCT FROM ct.tenant_id
GROUP BY bd.id, bd.name, bd.campaign_type
ORDER BY max(bd.created_at) DESC;

-- 2) Correção
BEGIN;

WITH wrong AS (
  SELECT DISTINCT c.id AS conversation_id, ct.tenant_id AS right_tenant
  FROM bulk_dispatch_contacts bdc
  JOIN conversations c ON c.id = bdc.conversation_id
  JOIN contacts ct ON ct.id = c.contact_id
  WHERE c.tenant_id IS DISTINCT FROM ct.tenant_id
), fix_msgs AS (
  UPDATE messages m
  SET tenant_id = w.right_tenant
  FROM wrong w
  WHERE m.conversation_id = w.conversation_id
    AND m.tenant_id IS DISTINCT FROM w.right_tenant
  RETURNING m.id
)
UPDATE conversations c
SET tenant_id = w.right_tenant
FROM wrong w
WHERE c.id = w.conversation_id;

COMMIT;
