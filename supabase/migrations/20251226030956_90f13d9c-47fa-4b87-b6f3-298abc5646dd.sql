-- Create function to calculate and update SLA status based on company settings
CREATE OR REPLACE FUNCTION public.calculate_sla_status()
RETURNS TRIGGER AS $$
DECLARE
  first_response_minutes INTEGER;
  resolution_minutes INTEGER;
  response_time_minutes INTEGER;
  resolution_time_minutes INTEGER;
  new_sla_status TEXT;
BEGIN
  -- Get SLA settings from company_settings
  SELECT 
    COALESCE(sla_first_response_minutes, 5),
    COALESCE(sla_resolution_minutes, 60)
  INTO first_response_minutes, resolution_minutes
  FROM company_settings
  WHERE tenant_id = NEW.tenant_id
  LIMIT 1;

  -- Default values if no settings found
  IF first_response_minutes IS NULL THEN
    first_response_minutes := 5;
  END IF;
  IF resolution_minutes IS NULL THEN
    resolution_minutes := 60;
  END IF;

  -- Calculate response time if first_response_at exists
  IF NEW.first_response_at IS NOT NULL THEN
    response_time_minutes := EXTRACT(EPOCH FROM (NEW.first_response_at - NEW.created_at)) / 60;
    
    -- Determine SLA status based on first response time
    IF response_time_minutes <= first_response_minutes THEN
      new_sla_status := 'ok';
    ELSIF response_time_minutes <= (first_response_minutes * 2) THEN
      new_sla_status := 'warning';
    ELSE
      new_sla_status := 'critical';
    END IF;
  ELSE
    -- If no response yet, check time since creation
    response_time_minutes := EXTRACT(EPOCH FROM (NOW() - NEW.created_at)) / 60;
    
    IF response_time_minutes <= first_response_minutes THEN
      new_sla_status := 'ok';
    ELSIF response_time_minutes <= (first_response_minutes * 2) THEN
      new_sla_status := 'warning';
    ELSE
      new_sla_status := 'critical';
    END IF;
  END IF;

  -- Only update if SLA status changed
  IF NEW.sla_status IS DISTINCT FROM new_sla_status THEN
    NEW.sla_status := new_sla_status;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_calculate_sla_status ON conversations;

-- Create trigger to calculate SLA on insert and update
CREATE TRIGGER trigger_calculate_sla_status
  BEFORE INSERT OR UPDATE OF first_response_at, created_at
  ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION calculate_sla_status();

-- Update existing conversations to recalculate SLA
UPDATE conversations 
SET sla_status = sla_status 
WHERE first_response_at IS NOT NULL;