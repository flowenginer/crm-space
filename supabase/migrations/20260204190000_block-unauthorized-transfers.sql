-- =========================================================================
-- PROTEÇÃO BACKEND: Bloquear transferências não autorizadas
-- =========================================================================
-- Este trigger garante que mesmo se o frontend for burlado, usuários
-- sem permissão de transferência NÃO conseguirão alterar assigned_to.
-- =========================================================================

-- =========================================================================
-- PARTE 1: Função de trigger para validar transferências
-- =========================================================================

CREATE OR REPLACE FUNCTION public.validate_conversation_transfer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id uuid;
  current_user_role text;
  can_transfer boolean;
BEGIN
  -- Obter ID do usuário atual
  current_user_id := auth.uid();

  -- Se não há usuário autenticado (service_role), permitir
  -- Service role é usado por automações, webhooks, etc.
  IF current_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Obter role do usuário atual
  SELECT role INTO current_user_role
  FROM profiles
  WHERE id = current_user_id;

  -- Admin e Supervisor podem sempre transferir
  IF current_user_role IN ('admin', 'supervisor') THEN
    RETURN NEW;
  END IF;

  -- Verificar se o assigned_to está sendo alterado (transferência)
  IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
    -- Verificar se o usuário pode transferir livremente
    can_transfer := public.can_transfer_freely(current_user_id);

    IF NOT can_transfer THEN
      RAISE EXCEPTION 'Você não tem permissão para transferir conversas. Contate um administrador.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.validate_conversation_transfer IS
'Trigger function que valida se o usuário tem permissão para transferir conversas.
Bloqueia alterações em assigned_to para usuários sem can_transfer_freely.';

-- =========================================================================
-- PARTE 2: Criar o trigger na tabela conversations
-- =========================================================================

-- Remover trigger se já existir
DROP TRIGGER IF EXISTS trg_validate_conversation_transfer ON conversations;

-- Criar trigger que executa ANTES do UPDATE
CREATE TRIGGER trg_validate_conversation_transfer
  BEFORE UPDATE ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_conversation_transfer();

-- =========================================================================
-- PARTE 3: Função auxiliar para transferência segura (opcional)
-- =========================================================================
-- Esta função pode ser usada pelo frontend para fazer transferências
-- de forma mais segura, verificando permissões antes de tentar.

CREATE OR REPLACE FUNCTION public.transfer_conversation(
  _conversation_id uuid,
  _new_assigned_to uuid,
  _new_department_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id uuid;
  current_user_role text;
  can_transfer boolean;
  conv_tenant_id uuid;
  result jsonb;
BEGIN
  -- Obter ID do usuário atual
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;

  -- Obter role do usuário
  SELECT role INTO current_user_role
  FROM profiles
  WHERE id = current_user_id;

  -- Verificar permissão
  IF current_user_role NOT IN ('admin', 'supervisor') THEN
    can_transfer := public.can_transfer_freely(current_user_id);

    IF NOT can_transfer THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Você não tem permissão para transferir conversas'
      );
    END IF;
  END IF;

  -- Obter tenant_id da conversa
  SELECT tenant_id INTO conv_tenant_id
  FROM conversations
  WHERE id = _conversation_id;

  IF conv_tenant_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Conversa não encontrada');
  END IF;

  -- Verificar se o novo atendente pertence ao mesmo tenant
  IF _new_assigned_to IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM profiles
      WHERE id = _new_assigned_to
      AND tenant_id = conv_tenant_id
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Atendente não encontrado ou de outro tenant');
    END IF;
  END IF;

  -- Verificar se o novo departamento pertence ao mesmo tenant
  IF _new_department_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM departments
      WHERE id = _new_department_id
      AND tenant_id = conv_tenant_id
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Departamento não encontrado ou de outro tenant');
    END IF;
  END IF;

  -- Realizar a transferência
  UPDATE conversations
  SET
    assigned_to = _new_assigned_to,
    department_id = COALESCE(_new_department_id, department_id),
    transferred_at = NOW(),
    is_new_transfer = TRUE,
    updated_at = NOW()
  WHERE id = _conversation_id
  AND tenant_id = conv_tenant_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Falha ao transferir conversa');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

COMMENT ON FUNCTION public.transfer_conversation IS
'Função segura para transferir conversas. Verifica permissões e tenant antes de transferir.';

-- =========================================================================
-- FIM DA MIGRAÇÃO
-- =========================================================================
