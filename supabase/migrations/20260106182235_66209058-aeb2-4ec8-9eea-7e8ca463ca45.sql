CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id uuid;
  v_invitation record;
  v_has_invitation boolean := false;
  v_raw_meta jsonb;
  v_skip_auto_tenant boolean;
  v_assigned_tenant_id uuid;
  v_role_text text;
  v_app_role app_role;
BEGIN
  v_raw_meta := NEW.raw_user_meta_data;
  v_skip_auto_tenant := COALESCE((v_raw_meta->>'skip_auto_tenant')::boolean, false);
  v_assigned_tenant_id := (v_raw_meta->>'tenant_id')::uuid;

  -- Default role from metadata (admin createUser passes this)
  v_role_text := COALESCE(v_raw_meta->>'role', 'user');

  IF v_assigned_tenant_id IS NOT NULL THEN
    v_tenant_id := v_assigned_tenant_id;
  ELSIF v_skip_auto_tenant THEN
    RETURN NEW;
  ELSE
    SELECT * INTO v_invitation
    FROM public.tenant_invitations
    WHERE email = NEW.email
      AND status = 'pending'
    ORDER BY created_at DESC
    LIMIT 1;

    v_has_invitation := FOUND;

    IF v_has_invitation AND v_invitation.id IS NOT NULL THEN
      v_tenant_id := v_invitation.tenant_id;
      v_role_text := COALESCE(v_invitation.role, v_role_text);

      UPDATE public.tenant_invitations
      SET status = 'accepted', updated_at = now()
      WHERE id = v_invitation.id;
    ELSE
      INSERT INTO public.tenants (name, slug, plan_type, is_active)
      VALUES (
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)) || '''s Organization',
        'org-' || substr(gen_random_uuid()::text, 1, 8),
        'free', true
      )
      RETURNING id INTO v_tenant_id;
    END IF;
  END IF;

  INSERT INTO public.profiles (id, full_name, email, tenant_id, role, is_active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    v_tenant_id,
    v_role_text,
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    tenant_id = COALESCE(profiles.tenant_id, EXCLUDED.tenant_id),
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    email = COALESCE(EXCLUDED.email, profiles.email);

  -- Cast to app_role with fallback
  BEGIN
    v_app_role := v_role_text::app_role;
  EXCEPTION WHEN invalid_text_representation THEN
    v_app_role := 'user'::app_role;
  END;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_app_role)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;