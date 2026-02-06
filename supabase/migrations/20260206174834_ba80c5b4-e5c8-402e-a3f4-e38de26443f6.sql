
CREATE OR REPLACE FUNCTION public.track_conversation_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assignment_type TEXT;
  v_time_to_assign INTEGER;
BEGIN
  -- Only track if assigned_to actually changed
  IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
    -- Determine assignment type
    IF OLD.assigned_to IS NULL THEN
      v_assignment_type := 'initial';
    ELSE
      v_assignment_type := 'transfer';
    END IF;

    -- Calculate time to assign (seconds since conversation creation)
    IF OLD.assigned_to IS NULL AND NEW.assigned_to IS NOT NULL THEN
      v_time_to_assign := EXTRACT(EPOCH FROM (now() - NEW.created_at))::INTEGER;
    END IF;

    INSERT INTO lead_assignment_history (
      contact_id, conversation_id, assigned_from, assigned_to,
      assigned_by, assignment_type, time_to_assign_seconds, tenant_id
    ) VALUES (
      NEW.contact_id, NEW.id, OLD.assigned_to, NEW.assigned_to,
      auth.uid(), v_assignment_type, v_time_to_assign, NEW.tenant_id
    );
  END IF;

  RETURN NEW;
END;
$$;
