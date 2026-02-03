-- =========================================================================
-- SINCRONIZAÇÃO DE DADOS: Corrigir conversas desincronizadas
-- =========================================================================
-- Este script atualiza o lead_status de todas as conversas abertas/pending
-- para refletir o lead_status atual do contato.
-- =========================================================================

-- Sincronizar todas as conversas abertas/pending com o lead_status do contato
UPDATE conversations conv
SET lead_status = c.lead_status
FROM contacts c
WHERE conv.contact_id = c.id
  AND conv.status IN ('open', 'pending')
  AND c.lead_status IS DISTINCT FROM conv.lead_status;