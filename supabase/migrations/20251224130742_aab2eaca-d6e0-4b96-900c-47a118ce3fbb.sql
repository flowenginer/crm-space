-- Drop and recreate handle_new_user to handle admin creation properly
-- When user_metadata contains 'skip_auto_tenant' or 'tenant_id', skip auto-tenant creation

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_invitation record;
  v_raw_meta jsonb;
  v_skip_auto_tenant boolean;
  v_assigned_tenant_id uuid;
BEGIN
  -- Get raw_user_meta_data
  v_raw_meta := NEW.raw_user_meta_data;
  
  -- Check if we should skip auto-tenant creation (for admin-created users)
  v_skip_auto_tenant := COALESCE((v_raw_meta->>'skip_auto_tenant')::boolean, false);
  v_assigned_tenant_id := (v_raw_meta->>'tenant_id')::uuid;
  
  -- If a tenant_id was provided in metadata, use it directly
  IF v_assigned_tenant_id IS NOT NULL THEN
    v_tenant_id := v_assigned_tenant_id;
  ELSIF v_skip_auto_tenant THEN
    -- Skip auto-tenant creation, profile will be created by caller
    RETURN NEW;
  ELSE
    -- Try to find an invitation for this email
    SELECT * INTO v_invitation
    FROM public.invitations
    WHERE email = NEW.email
      AND status = 'pending'
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF v_invitation.id IS NOT NULL THEN
      -- Use tenant from invitation
      v_tenant_id := v_invitation.tenant_id;
      
      -- Mark invitation as accepted
      UPDATE public.invitations
      SET status = 'accepted',
          accepted_at = now()
      WHERE id = v_invitation.id;
    ELSE
      -- No invitation, create a new tenant for this user
      INSERT INTO public.tenants (name, slug, plan_type, is_active)
      VALUES (
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)) || '''s Organization',
        'org-' || substr(gen_random_uuid()::text, 1, 8),
        'free',
        true
      )
      RETURNING id INTO v_tenant_id;
    END IF;
  END IF;

  -- Insert into profiles with the determined tenant_id
  INSERT INTO public.profiles (id, full_name, email, tenant_id, role, is_active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    v_tenant_id,
    COALESCE(v_invitation.role, 'user'),
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    tenant_id = COALESCE(profiles.tenant_id, EXCLUDED.tenant_id),
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    email = COALESCE(EXCLUDED.email, profiles.email);

  -- Create default user role if not from invitation with specific role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE(v_invitation.role, 'user'))
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;