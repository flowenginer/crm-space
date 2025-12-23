-- Corrige erro de FK role_definitions_tenant_id_fkey ao deletar tenant
CREATE OR REPLACE FUNCTION public.delete_tenant_by_super_admin(p_tenant_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if current user is super admin
  IF NOT current_user_is_super_admin() THEN
    RAISE EXCEPTION 'Access denied: Super admin privileges required';
  END IF;

  -- Delete in order of dependencies (children first)

  -- Messages and conversations
  DELETE FROM messages WHERE tenant_id = p_tenant_id;
  DELETE FROM conversation_events WHERE tenant_id = p_tenant_id;
  DELETE FROM conversation_tags WHERE tenant_id = p_tenant_id;
  DELETE FROM conversations WHERE tenant_id = p_tenant_id;

  -- Contacts and related
  DELETE FROM contact_tags WHERE tenant_id = p_tenant_id;
  DELETE FROM contact_requests WHERE tenant_id = p_tenant_id;
  DELETE FROM contacts WHERE tenant_id = p_tenant_id;

  -- Internal chat
  DELETE FROM internal_chat_messages WHERE tenant_id = p_tenant_id;
  DELETE FROM internal_chat_participants WHERE tenant_id = p_tenant_id;
  DELETE FROM internal_chat_threads WHERE tenant_id = p_tenant_id;

  -- Internal email
  DELETE FROM internal_email_attachments WHERE tenant_id = p_tenant_id;
  DELETE FROM internal_email_labels WHERE tenant_id = p_tenant_id;
  DELETE FROM internal_email_recipients WHERE tenant_id = p_tenant_id;
  DELETE FROM internal_emails WHERE tenant_id = p_tenant_id;

  -- Internal notes
  DELETE FROM internal_notes WHERE tenant_id = p_tenant_id;

  -- User related
  DELETE FROM user_departments WHERE user_id IN (SELECT id FROM profiles WHERE tenant_id = p_tenant_id);
  DELETE FROM user_roles WHERE user_id IN (SELECT id FROM profiles WHERE tenant_id = p_tenant_id);
  DELETE FROM user_sessions WHERE user_id IN (SELECT id FROM profiles WHERE tenant_id = p_tenant_id);
  DELETE FROM notification_settings WHERE user_id IN (SELECT id FROM profiles WHERE tenant_id = p_tenant_id);
  DELETE FROM gamification_points WHERE user_id IN (SELECT id FROM profiles WHERE tenant_id = p_tenant_id);
  DELETE FROM profiles WHERE tenant_id = p_tenant_id;

  -- WhatsApp
  DELETE FROM whatsapp_channels WHERE tenant_id = p_tenant_id;

  -- Templates
  DELETE FROM rescue_templates WHERE tenant_id = p_tenant_id;

  -- Roles definitions (corrige FK)
  DELETE FROM role_definitions WHERE tenant_id = p_tenant_id;

  -- Tags and departments
  DELETE FROM tags WHERE tenant_id = p_tenant_id;
  DELETE FROM departments WHERE tenant_id = p_tenant_id;

  -- Lead statuses
  DELETE FROM lead_statuses WHERE tenant_id = p_tenant_id;

  -- Company settings
  DELETE FROM company_settings WHERE tenant_id = p_tenant_id;

  -- Menu items
  DELETE FROM menu_items WHERE tenant_id = p_tenant_id;

  -- Invitations
  DELETE FROM tenant_invitations WHERE tenant_id = p_tenant_id;

  -- Tenant modules
  DELETE FROM tenant_modules WHERE tenant_id = p_tenant_id;

  -- Finally delete the tenant
  DELETE FROM tenants WHERE id = p_tenant_id;
END;
$function$;