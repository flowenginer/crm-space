-- =========================================================================
-- CORREÇÃO: Automação set_lead_status falhando para Edge Functions
-- =========================================================================
-- PROBLEMA: Edge Functions com service_role não têm usuário autenticado,
-- então o trigger set_tenant_id_from_user falha ao inserir em lead_status_history
-- 
-- SOLUÇÃO: A função track_lead_status_change deve incluir tenant_id explicitamente
-- =========================================================================

CREATE OR REPLACE FUNCTION track_lead_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_duration INTEGER;
BEGIN
  -- Só registra se o status realmente mudou
  IF OLD.lead_status IS DISTINCT FROM NEW.lead_status THEN
    -- Calcular duração no status anterior (em segundos)
    v_duration := EXTRACT(EPOCH FROM (NOW() - COALESCE(OLD.updated_at, OLD.created_at)))::INTEGER;
    
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
      auth.uid(),  -- Pode ser NULL quando chamado por Edge Function
      v_duration,
      NEW.tenant_id  -- Pegar tenant_id do contato que está sendo atualizado
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;