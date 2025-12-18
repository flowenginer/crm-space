-- Add columns for on_reply_action configuration
ALTER TABLE public.rescue_templates 
ADD COLUMN IF NOT EXISTS on_reply_action TEXT DEFAULT 'none';

ALTER TABLE public.rescue_templates 
ADD COLUMN IF NOT EXISTS on_reply_config JSONB DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN public.rescue_templates.on_reply_action IS 'Action when client replies: none, transfer_agent, transfer_department, add_tag, change_lead_status, add_segment';
COMMENT ON COLUMN public.rescue_templates.on_reply_config IS 'Configuration for on_reply_action: agent_id, department_id, tag_id, lead_status, segment_id';

-- Expand final_action to support more options (drop constraint if exists and add new one)
-- Note: The existing values (close, transfer, none) remain valid, we just add more options

-- Create function to execute on_reply_action when rescue is responded
CREATE OR REPLACE FUNCTION public.execute_rescue_on_reply_action()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_template RECORD;
  v_conversation_id UUID;
  v_contact_id UUID;
BEGIN
  -- Only process when status changes to 'responded'
  IF OLD.status = 'active' AND NEW.status = 'responded' THEN
    -- Get template configuration
    SELECT on_reply_action, on_reply_config INTO v_template
    FROM rescue_templates
    WHERE id = NEW.template_id;
    
    v_conversation_id := NEW.conversation_id;
    v_contact_id := NEW.contact_id;
    
    -- Execute action based on configuration
    IF v_template.on_reply_action = 'transfer_agent' AND v_template.on_reply_config->>'agent_id' IS NOT NULL THEN
      UPDATE conversations 
      SET assigned_to = (v_template.on_reply_config->>'agent_id')::UUID,
          updated_at = now()
      WHERE id = v_conversation_id;
      
    ELSIF v_template.on_reply_action = 'transfer_department' AND v_template.on_reply_config->>'department_id' IS NOT NULL THEN
      UPDATE conversations 
      SET department_id = (v_template.on_reply_config->>'department_id')::UUID,
          assigned_to = NULL,
          updated_at = now()
      WHERE id = v_conversation_id;
      
    ELSIF v_template.on_reply_action = 'add_tag' AND v_template.on_reply_config->>'tag_id' IS NOT NULL THEN
      INSERT INTO contact_tags (contact_id, tag_id)
      VALUES (v_contact_id, (v_template.on_reply_config->>'tag_id')::UUID)
      ON CONFLICT DO NOTHING;
      
    ELSIF v_template.on_reply_action = 'change_lead_status' AND v_template.on_reply_config->>'lead_status' IS NOT NULL THEN
      UPDATE contacts 
      SET lead_status = v_template.on_reply_config->>'lead_status',
          updated_at = now()
      WHERE id = v_contact_id;
      
    ELSIF v_template.on_reply_action = 'add_segment' AND v_template.on_reply_config->>'segment_id' IS NOT NULL THEN
      UPDATE contacts
      SET segment_id = (v_template.on_reply_config->>'segment_id')::UUID,
          updated_at = now()
      WHERE id = v_contact_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to execute on_reply_action
DROP TRIGGER IF EXISTS trigger_rescue_on_reply_action ON active_rescues;
CREATE TRIGGER trigger_rescue_on_reply_action
  AFTER UPDATE ON active_rescues
  FOR EACH ROW
  EXECUTE FUNCTION execute_rescue_on_reply_action();