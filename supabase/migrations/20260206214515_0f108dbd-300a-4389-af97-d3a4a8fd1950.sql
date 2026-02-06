CREATE OR REPLACE FUNCTION public.gamification_on_lead_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_points INTEGER := 0;
  v_assigned_user UUID;
BEGIN
  IF OLD.lead_status IS DISTINCT FROM NEW.lead_status AND NEW.lead_status IS NOT NULL THEN
    v_points := CASE NEW.lead_status
      WHEN 'catalogo' THEN 10
      WHEN 'orcamento' THEN 20
      WHEN 'layout' THEN 30
      WHEN 'aguardando_pagamento' THEN 40
      WHEN 'pago' THEN 100
      ELSE 5
    END;
    
    v_assigned_user := NEW.assigned_to;
    
    IF v_assigned_user IS NOT NULL AND v_points > 0 THEN
      INSERT INTO gamification_points (user_id, points, action_type, reference_type, reference_id, description, tenant_id)
      VALUES (v_assigned_user, v_points, 'status_change', 'contact', NEW.id, 'Mudança para status: ' || NEW.lead_status, NEW.tenant_id);
      
      INSERT INTO gamification_profiles (user_id, total_points, total_points_alltime, tenant_id)
      VALUES (v_assigned_user, v_points, v_points, NEW.tenant_id)
      ON CONFLICT (user_id) DO UPDATE SET
        total_points = gamification_profiles.total_points + v_points,
        total_points_alltime = gamification_profiles.total_points_alltime + v_points,
        updated_at = NOW();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;