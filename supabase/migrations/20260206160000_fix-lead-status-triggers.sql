-- =========================================================================
-- CORREÇÃO: Unificar triggers de lead_status para funcionar com Edge Functions
-- =========================================================================
-- PROBLEMA:
-- 1. Trigger antigo "on_lead_status_change" usa função track_lead_status_change
--    que não passava tenant_id explícito
-- 2. Trigger novo "trg_record_lead_status_change" foi criado mas conflita
-- 3. Edge Functions não têm auth.uid(), então set_tenant_id_from_user falha
--
-- SOLUÇÃO:
-- 1. Dropar TODOS os triggers antigos relacionados a lead_status
-- 2. Atualizar a função track_lead_status_change para incluir tenant_id
-- 3. Recriar apenas UM trigger com a função corrigida
-- =========================================================================

-- 1. Dropar todos os triggers relacionados a lead_status no contacts
DROP TRIGGER IF EXISTS on_lead_status_change ON public.contacts;
DROP TRIGGER IF EXISTS trg_record_lead_status_change ON public.contacts;
DROP TRIGGER IF EXISTS trigger_lead_status_change ON public.contacts;

-- 2. Atualizar a função track_lead_status_change para incluir tenant_id
CREATE OR REPLACE FUNCTION public.track_lead_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_duration INTEGER;
BEGIN
  -- Só registra se o status realmente mudou
  IF OLD.lead_status IS DISTINCT FROM NEW.lead_status THEN
    -- Calcular duração no status anterior (em segundos)
    v_duration := EXTRACT(EPOCH FROM (NOW() - COALESCE(OLD.updated_at, OLD.created_at)))::INTEGER;

    -- CRÍTICO: Incluir tenant_id explícito do contato
    -- Isso permite que Edge Functions (sem auth.uid()) funcionem corretamente
    INSERT INTO lead_status_history (
      contact_id,
      previous_status,
      new_status,
      changed_by,
      duration_seconds,
      tenant_id  -- CORREÇÃO: Incluir tenant_id explícito
    )
    VALUES (
      NEW.id,
      OLD.lead_status,
      NEW.lead_status,
      auth.uid(),  -- Pode ser NULL quando chamado por Edge Function com service_role
      v_duration,
      NEW.tenant_id  -- CORREÇÃO: Usar tenant_id do contato que está sendo atualizado
    );

    -- Log para debug (visível nos logs do Supabase)
    RAISE LOG '[track_lead_status_change] tenant_id=% contact_id=% status: % → %',
      NEW.tenant_id,
      NEW.id,
      COALESCE(OLD.lead_status, 'NULL'),
      COALESCE(NEW.lead_status, 'NULL');
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.track_lead_status_change() IS
'Registra mudanças de lead_status no histórico.
CORREÇÃO 2026-02-06: Agora inclui tenant_id explícito do contato, permitindo
que Edge Functions com service_role funcionem corretamente.';

-- 3. Criar único trigger para lead_status (AFTER UPDATE, não BEFORE)
-- Usar AFTER para garantir que o UPDATE foi bem-sucedido antes de registrar
CREATE TRIGGER trg_track_lead_status_change
  AFTER UPDATE OF lead_status ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.track_lead_status_change();

-- 4. Também dropar a função duplicada record_lead_status_change se existir
-- (ela foi criada em uma migration anterior mas agora é redundante)
DROP FUNCTION IF EXISTS public.record_lead_status_change() CASCADE;

-- =========================================================================
-- PARTE 2: Garantir que lead_status_history não tenha trigger de tenant_id
-- =========================================================================
-- Remover qualquer trigger que tente auto-preencher tenant_id
-- pois agora o tenant_id é passado explicitamente pela função

-- Lista de possíveis nomes de triggers que podem causar o erro
DROP TRIGGER IF EXISTS set_tenant_id_trigger ON public.lead_status_history;
DROP TRIGGER IF EXISTS trigger_set_tenant_id ON public.lead_status_history;
DROP TRIGGER IF EXISTS trg_set_tenant_id ON public.lead_status_history;
DROP TRIGGER IF EXISTS set_tenant_id_from_user_trigger ON public.lead_status_history;

-- Garantir que a coluna tenant_id tem um default seguro (para casos de fallback)
-- Mas o trigger acima SEMPRE passará o tenant_id correto
ALTER TABLE public.lead_status_history
  ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';

-- =========================================================================
-- VERIFICAÇÃO: Listar triggers atuais na tabela contacts
-- =========================================================================
DO $$
DECLARE
  r RECORD;
BEGIN
  RAISE LOG '=== Triggers na tabela contacts após correção ===';
  FOR r IN
    SELECT tgname as trigger_name, proname as function_name
    FROM pg_trigger t
    JOIN pg_proc p ON t.tgfoid = p.oid
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE c.relname = 'contacts' AND NOT t.tgisinternal
  LOOP
    RAISE LOG 'Trigger: % -> Função: %', r.trigger_name, r.function_name;
  END LOOP;
END $$;
