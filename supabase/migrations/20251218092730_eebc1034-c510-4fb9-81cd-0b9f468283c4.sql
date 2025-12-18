-- Function to permanently delete a contact and all related data (admin only)
CREATE OR REPLACE FUNCTION public.delete_contact_permanently(p_contact_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only allow admins/supervisors
  IF NOT is_admin_or_supervisor(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores podem excluir contatos permanentemente';
  END IF;

  -- Delete orders (NO ACTION constraint)
  DELETE FROM orders WHERE contact_id = p_contact_id;
  
  -- Delete quotes (NO ACTION constraint)
  DELETE FROM quotes WHERE contact_id = p_contact_id;
  
  -- Delete financial_transactions (NO ACTION constraint)
  DELETE FROM financial_transactions WHERE contact_id = p_contact_id;
  
  -- Delete deals
  DELETE FROM deals WHERE contact_id = p_contact_id;
  
  -- Delete call_logs
  DELETE FROM call_logs WHERE contact_id = p_contact_id;
  
  -- Delete contact_requests
  DELETE FROM contact_requests WHERE contact_id = p_contact_id;
  
  -- Delete active_rescues
  DELETE FROM active_rescues WHERE contact_id = p_contact_id;
  
  -- Delete flow_executions
  DELETE FROM flow_executions WHERE contact_id = p_contact_id;
  
  -- Now delete the contact (CASCADE will handle contact_tags, conversations->messages, etc.)
  DELETE FROM contacts WHERE id = p_contact_id;
END;
$$;