-- Triggers para garantir consistencia de conversations vs canais.
--
-- Contexto: caso ADRIANO RECEPTIVO (06/05/2026) — contato com 2 conversas
-- open simultaneas em canais distintos (API_Oficial connected + VENDAS 02
-- disconnected). Atendente nao conseguia mandar mensagem na API Oficial:
--   1) RLS bloqueava SELECT na conv API_Oficial (department_id NULL)
--   2) Toast "ja existe conversa aberta neste canal" via unique index
--      parcial (contact_id, channel_id) WHERE status IN ('open','pending')
--
-- Cleanup retroativo aplicado em paralelo (mesmo dia):
--   - 1.014 conversas fechadas em canais disconnected com alternativa
--     connected (A.1)
--   - 938 conversas orfas em official ganharam department do canal (A.2)
--   - Backup em public.backup_conversations_orphan_cleanup_20260506
--
-- Triggers desta migration:
--
-- 1a (BEFORE INSERT OR UPDATE OF channel_id):
--   Preenche conversations.department_id com o whatsapp_channels.department_id
--   quando NEW.department_id IS NULL e o canal tem department configurado.
--   Cobre todos os call sites (frontend, edges, n8n, jobs SQL) numa unica
--   barreira no banco — defensive em vez de patchar cada caminho.
--
-- 1b (AFTER INSERT):
--   Quando uma conversation open/pending eh criada num canal connected,
--   fecha automaticamente conversations open/pending do mesmo contact_id
--   em canais disconnected do mesmo tenant. Previne acumulo de orfas
--   conforme aconteceu no historico.

CREATE OR REPLACE FUNCTION fill_conversation_department_from_channel()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.department_id IS NULL AND NEW.channel_id IS NOT NULL THEN
    SELECT department_id INTO NEW.department_id
    FROM whatsapp_channels
    WHERE id = NEW.channel_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS conversations_fill_department_default ON conversations;
CREATE TRIGGER conversations_fill_department_default
BEFORE INSERT OR UPDATE OF channel_id ON conversations
FOR EACH ROW
EXECUTE FUNCTION fill_conversation_department_from_channel();

CREATE OR REPLACE FUNCTION close_disconnected_dupe_conversations()
RETURNS TRIGGER AS $$
DECLARE
  new_channel_status text;
  new_channel_tenant uuid;
BEGIN
  IF NEW.status NOT IN ('open','pending') OR NEW.channel_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT status, tenant_id INTO new_channel_status, new_channel_tenant
  FROM whatsapp_channels
  WHERE id = NEW.channel_id;

  IF new_channel_status <> 'connected' THEN
    RETURN NEW;
  END IF;

  UPDATE conversations old_conv
  SET status = 'closed',
      closed_at = now(),
      updated_at = now()
  FROM whatsapp_channels old_wc
  WHERE old_conv.channel_id = old_wc.id
    AND old_conv.id <> NEW.id
    AND old_conv.contact_id = NEW.contact_id
    AND old_conv.status IN ('open','pending')
    AND old_wc.status = 'disconnected'
    AND old_wc.tenant_id = new_channel_tenant;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS conversations_close_disconnected_dupes ON conversations;
CREATE TRIGGER conversations_close_disconnected_dupes
AFTER INSERT ON conversations
FOR EACH ROW
EXECUTE FUNCTION close_disconnected_dupe_conversations();
