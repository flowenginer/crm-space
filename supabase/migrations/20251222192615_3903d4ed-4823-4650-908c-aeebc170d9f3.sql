-- Update delete_contact_permanently to also delete bulk_dispatch_contacts records
CREATE OR REPLACE FUNCTION public.delete_contact_permanently(p_contact_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order_ids uuid[];
  v_quote_ids uuid[];
  v_rescue_ids uuid[];
BEGIN
  -- Only allow admins/supervisors
  IF NOT is_admin_or_supervisor(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores podem excluir contatos permanentemente';
  END IF;

  -- Get order IDs for this contact
  SELECT array_agg(id) INTO v_order_ids FROM orders WHERE contact_id = p_contact_id;
  
  -- Get quote IDs for this contact  
  SELECT array_agg(id) INTO v_quote_ids FROM quotes WHERE contact_id = p_contact_id;

  -- Get rescue IDs for this contact
  SELECT array_agg(id) INTO v_rescue_ids FROM active_rescues WHERE contact_id = p_contact_id;

  -- 1. Remove FK from quotes to orders (converted_to_order_id)
  UPDATE quotes SET converted_to_order_id = NULL 
  WHERE contact_id = p_contact_id AND converted_to_order_id IS NOT NULL;

  -- 2. Delete financial_transactions FIRST (has FK to orders AND contacts)
  DELETE FROM financial_transactions WHERE contact_id = p_contact_id;
  IF v_order_ids IS NOT NULL THEN
    DELETE FROM financial_transactions WHERE order_id = ANY(v_order_ids);
  END IF;

  -- 3. Delete payment_links
  DELETE FROM payment_links WHERE contact_id = p_contact_id;
  IF v_order_ids IS NOT NULL THEN
    DELETE FROM payment_links WHERE order_id = ANY(v_order_ids);
  END IF;
  IF v_quote_ids IS NOT NULL THEN
    DELETE FROM payment_links WHERE quote_id = ANY(v_quote_ids);
  END IF;

  -- 4. Delete internal_emails related
  DELETE FROM internal_emails WHERE contact_id = p_contact_id;
  IF v_order_ids IS NOT NULL THEN
    DELETE FROM internal_emails WHERE order_id = ANY(v_order_ids);
  END IF;
  IF v_quote_ids IS NOT NULL THEN
    DELETE FROM internal_emails WHERE quote_id = ANY(v_quote_ids);
  END IF;

  -- 5. Delete quotes (quote_items CASCADE)
  DELETE FROM quotes WHERE contact_id = p_contact_id;

  -- 6. Delete orders (order_items, order_status_history, order_payments CASCADE)
  DELETE FROM orders WHERE contact_id = p_contact_id;

  -- 7. Delete other related tables
  DELETE FROM deals WHERE contact_id = p_contact_id;
  DELETE FROM call_logs WHERE contact_id = p_contact_id;
  DELETE FROM contact_requests WHERE contact_id = p_contact_id;

  -- 8. Delete bulk_dispatch_contacts for this contact (has direct FK to contacts)
  DELETE FROM bulk_dispatch_contacts WHERE contact_id = p_contact_id;

  -- 9. Clear bulk_dispatch_contacts references to rescues being deleted
  IF v_rescue_ids IS NOT NULL THEN
    UPDATE bulk_dispatch_contacts SET active_rescue_id = NULL 
    WHERE active_rescue_id = ANY(v_rescue_ids);
  END IF;

  -- 10. Delete active_rescues (after clearing references)
  DELETE FROM active_rescues WHERE contact_id = p_contact_id;

  -- 11. Delete flow_executions
  DELETE FROM flow_executions WHERE contact_id = p_contact_id;

  -- 12. Finally delete the contact (CASCADE handles: contact_tags, conversations->messages, etc.)
  DELETE FROM contacts WHERE id = p_contact_id;
END;
$function$;