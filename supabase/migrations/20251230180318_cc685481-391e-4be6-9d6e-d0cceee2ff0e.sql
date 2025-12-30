-- Atualizar trigger para NÃO remover assigned_to ao transferir departamento
CREATE OR REPLACE FUNCTION execute_rescue_on_reply_action()
RETURNS TRIGGER AS $$
DECLARE
  v_template RECORD;
  v_current_step INT;
  v_step_data JSONB;
  v_on_reply_action TEXT;
  v_on_reply_config JSONB;
  v_conversation_id UUID;
  v_contact_id UUID;
BEGIN
  -- Only process when status changes to 'responded'
  IF OLD.status = 'active' AND NEW.status = 'responded' THEN
    -- Get template configuration and current step
    SELECT steps, on_reply_action, on_reply_config INTO v_template
    FROM rescue_templates
    WHERE id = NEW.template_id;
    
    v_current_step := COALESCE(NEW.current_step, 0);
    v_conversation_id := NEW.conversation_id;
    v_contact_id := NEW.contact_id;
    
    -- Try to get step-specific action (new approach)
    IF v_template.steps IS NOT NULL AND jsonb_array_length(v_template.steps) > v_current_step THEN
      v_step_data := v_template.steps->v_current_step;
      v_on_reply_action := COALESCE(v_step_data->>'on_reply_action', v_template.on_reply_action, 'none');
      v_on_reply_config := COALESCE(v_step_data->'on_reply_config', v_template.on_reply_config, '{}'::JSONB);
    ELSE
      -- Fall back to template-level config (backwards compatibility)
      v_on_reply_action := COALESCE(v_template.on_reply_action, 'none');
      v_on_reply_config := COALESCE(v_template.on_reply_config, '{}'::JSONB);
    END IF;
    
    -- Log the action being executed
    RAISE LOG 'Executing on_reply_action: % for step % with config %', v_on_reply_action, v_current_step, v_on_reply_config;
    
    -- Execute action based on configuration
    IF v_on_reply_action = 'transfer_agent' AND v_on_reply_config->>'agent_id' IS NOT NULL THEN
      UPDATE conversations 
      SET assigned_to = (v_on_reply_config->>'agent_id')::UUID,
          updated_at = now()
      WHERE id = v_conversation_id;
      
    ELSIF v_on_reply_action = 'transfer_department' AND v_on_reply_config->>'department_id' IS NOT NULL THEN
      -- Apenas muda o departamento, mantém o atendente atual
      UPDATE conversations 
      SET department_id = (v_on_reply_config->>'department_id')::UUID,
          updated_at = now()
      WHERE id = v_conversation_id;
      
    ELSIF v_on_reply_action = 'add_tag' AND v_on_reply_config->>'tag_id' IS NOT NULL THEN
      INSERT INTO contact_tags (contact_id, tag_id)
      VALUES (v_contact_id, (v_on_reply_config->>'tag_id')::UUID)
      ON CONFLICT DO NOTHING;
      
    ELSIF v_on_reply_action = 'change_lead_status' AND v_on_reply_config->>'lead_status' IS NOT NULL THEN
      UPDATE contacts 
      SET lead_status = v_on_reply_config->>'lead_status',
          updated_at = now()
      WHERE id = v_contact_id;
      
    ELSIF v_on_reply_action = 'add_segment' AND v_on_reply_config->>'segment_id' IS NOT NULL THEN
      UPDATE contacts
      SET segment_id = (v_on_reply_config->>'segment_id')::UUID,
          updated_at = now()
      WHERE id = v_contact_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;