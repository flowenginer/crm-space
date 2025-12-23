-- RPC para deletar um tenant completamente (somente super_admin)
CREATE OR REPLACE FUNCTION delete_tenant_by_super_admin(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_super_admin boolean;
  v_tenant_name text;
  v_deleted_counts jsonb;
  v_master_tenant_id uuid := '00000000-0000-0000-0000-000000000001'::uuid;
BEGIN
  -- Verificar se o usuário é super_admin
  SELECT current_user_is_super_admin() INTO v_is_super_admin;
  
  IF NOT v_is_super_admin THEN
    RAISE EXCEPTION 'Acesso negado: somente super admins podem deletar tenants';
  END IF;
  
  -- Não permitir deletar o tenant master
  IF p_tenant_id = v_master_tenant_id THEN
    RAISE EXCEPTION 'Não é permitido deletar o tenant master';
  END IF;
  
  -- Verificar se o tenant existe
  SELECT name INTO v_tenant_name FROM tenants WHERE id = p_tenant_id;
  
  IF v_tenant_name IS NULL THEN
    RAISE EXCEPTION 'Tenant não encontrado';
  END IF;
  
  -- Inicializar contadores
  v_deleted_counts := '{}';
  
  -- Deletar em ordem reversa de dependência
  
  -- 1. Logs e eventos
  DELETE FROM webhook_logs WHERE tenant_id = p_tenant_id;
  DELETE FROM email_activity_log WHERE tenant_id = p_tenant_id;
  DELETE FROM conversation_events WHERE tenant_id = p_tenant_id;
  DELETE FROM activity_log WHERE tenant_id = p_tenant_id;
  
  -- 2. Mensagens e comunicação
  DELETE FROM scheduled_messages WHERE tenant_id = p_tenant_id;
  DELETE FROM messages WHERE tenant_id = p_tenant_id;
  DELETE FROM internal_email_recipients WHERE tenant_id = p_tenant_id;
  DELETE FROM internal_emails WHERE tenant_id = p_tenant_id;
  DELETE FROM internal_messages WHERE tenant_id = p_tenant_id;
  DELETE FROM internal_chats WHERE tenant_id = p_tenant_id;
  
  -- 3. Bulk dispatch
  DELETE FROM bulk_dispatch_contacts WHERE tenant_id = p_tenant_id;
  DELETE FROM bulk_dispatches WHERE tenant_id = p_tenant_id;
  
  -- 4. Resgate
  DELETE FROM active_rescues WHERE tenant_id = p_tenant_id;
  DELETE FROM rescue_template_steps WHERE tenant_id = p_tenant_id;
  DELETE FROM rescue_templates WHERE tenant_id = p_tenant_id;
  
  -- 5. Tags e relacionamentos
  DELETE FROM contact_tags WHERE tenant_id = p_tenant_id;
  DELETE FROM conversation_tags WHERE tenant_id = p_tenant_id;
  DELETE FROM deal_tags WHERE tenant_id = p_tenant_id;
  
  -- 6. Compartilhamentos
  DELETE FROM shared_conversations WHERE tenant_id = p_tenant_id;
  DELETE FROM contact_requests WHERE tenant_id = p_tenant_id;
  DELETE FROM availability_release_requests WHERE tenant_id = p_tenant_id;
  
  -- 7. Gamificação
  DELETE FROM gamification_point_transactions WHERE tenant_id = p_tenant_id;
  DELETE FROM gamification_user_badges WHERE tenant_id = p_tenant_id;
  DELETE FROM gamification_badges WHERE tenant_id = p_tenant_id;
  DELETE FROM gamification_user_stats WHERE tenant_id = p_tenant_id;
  DELETE FROM gamification_daily_scores WHERE tenant_id = p_tenant_id;
  DELETE FROM gamification_seasons WHERE tenant_id = p_tenant_id;
  DELETE FROM gamification_settings WHERE tenant_id = p_tenant_id;
  
  -- 8. Financeiro
  DELETE FROM account_movements WHERE tenant_id = p_tenant_id;
  DELETE FROM financial_transactions WHERE tenant_id = p_tenant_id;
  DELETE FROM financial_accounts WHERE tenant_id = p_tenant_id;
  DELETE FROM financial_categories WHERE tenant_id = p_tenant_id;
  DELETE FROM payment_links WHERE tenant_id = p_tenant_id;
  
  -- 9. Pedidos e orçamentos
  DELETE FROM order_items WHERE tenant_id = p_tenant_id;
  DELETE FROM order_status_history WHERE tenant_id = p_tenant_id;
  DELETE FROM orders WHERE tenant_id = p_tenant_id;
  DELETE FROM quote_items WHERE tenant_id = p_tenant_id;
  DELETE FROM quote_status_history WHERE tenant_id = p_tenant_id;
  DELETE FROM quotes WHERE tenant_id = p_tenant_id;
  DELETE FROM order_statuses WHERE tenant_id = p_tenant_id;
  
  -- 10. Produtos
  DELETE FROM inventory_movements WHERE tenant_id = p_tenant_id;
  DELETE FROM product_variation_attributes WHERE tenant_id = p_tenant_id;
  DELETE FROM product_variations WHERE tenant_id = p_tenant_id;
  DELETE FROM product_template_attributes WHERE tenant_id = p_tenant_id;
  DELETE FROM product_templates WHERE tenant_id = p_tenant_id;
  DELETE FROM attribute_price_rules WHERE tenant_id = p_tenant_id;
  DELETE FROM attribute_values WHERE tenant_id = p_tenant_id;
  DELETE FROM attribute_types WHERE tenant_id = p_tenant_id;
  DELETE FROM products WHERE tenant_id = p_tenant_id;
  DELETE FROM product_catalogs WHERE tenant_id = p_tenant_id;
  
  -- 11. CRM
  DELETE FROM deal_tags WHERE tenant_id = p_tenant_id;
  DELETE FROM deals WHERE tenant_id = p_tenant_id;
  DELETE FROM pipeline_stages WHERE tenant_id = p_tenant_id;
  DELETE FROM pipelines WHERE tenant_id = p_tenant_id;
  DELETE FROM lead_status_history WHERE tenant_id = p_tenant_id;
  DELETE FROM lead_statuses WHERE tenant_id = p_tenant_id;
  
  -- 12. Métricas e relatórios
  DELETE FROM daily_metrics WHERE tenant_id = p_tenant_id;
  DELETE FROM call_logs WHERE tenant_id = p_tenant_id;
  DELETE FROM call_results WHERE tenant_id = p_tenant_id;
  DELETE FROM transfer_history WHERE tenant_id = p_tenant_id;
  DELETE FROM contact_merge_log WHERE tenant_id = p_tenant_id;
  
  -- 13. Conversas
  DELETE FROM conversations WHERE tenant_id = p_tenant_id;
  
  -- 14. Contatos
  DELETE FROM contacts WHERE tenant_id = p_tenant_id;
  
  -- 15. Chatbot e automação
  DELETE FROM flow_executions WHERE tenant_id = p_tenant_id;
  DELETE FROM flow_nodes WHERE tenant_id = p_tenant_id;
  DELETE FROM chatbot_flows WHERE tenant_id = p_tenant_id;
  
  -- 16. Canais e integrações
  DELETE FROM whatsapp_channels WHERE tenant_id = p_tenant_id;
  DELETE FROM webhooks WHERE tenant_id = p_tenant_id;
  DELETE FROM meta_ad_accounts WHERE tenant_id = p_tenant_id;
  DELETE FROM meta_accounts WHERE tenant_id = p_tenant_id;
  
  -- 17. Templates e mensagens rápidas
  DELETE FROM quick_templates WHERE tenant_id = p_tenant_id;
  DELETE FROM templates WHERE tenant_id = p_tenant_id;
  
  -- 18. Configurações
  DELETE FROM notification_settings WHERE tenant_id = p_tenant_id;
  DELETE FROM import_history WHERE tenant_id = p_tenant_id;
  DELETE FROM custom_field_definitions WHERE tenant_id = p_tenant_id;
  DELETE FROM required_fields_rules WHERE tenant_id = p_tenant_id;
  DELETE FROM close_reasons WHERE tenant_id = p_tenant_id;
  DELETE FROM tags WHERE tenant_id = p_tenant_id;
  DELETE FROM segments WHERE tenant_id = p_tenant_id;
  DELETE FROM queues WHERE tenant_id = p_tenant_id;
  DELETE FROM sales_goals WHERE tenant_id = p_tenant_id;
  DELETE FROM email_shared_box_members WHERE tenant_id = p_tenant_id;
  DELETE FROM email_shared_boxes WHERE tenant_id = p_tenant_id;
  DELETE FROM ad_message_patterns WHERE tenant_id = p_tenant_id;
  DELETE FROM quote_notification_config WHERE tenant_id = p_tenant_id;
  
  -- 19. Usuários (antes dos departamentos)
  DELETE FROM user_departments WHERE tenant_id = p_tenant_id;
  DELETE FROM user_sessions WHERE tenant_id = p_tenant_id;
  DELETE FROM invitations WHERE tenant_id = p_tenant_id;
  DELETE FROM profiles WHERE tenant_id = p_tenant_id;
  
  -- 20. Departamentos e roles
  DELETE FROM role_permissions WHERE tenant_id = p_tenant_id;
  DELETE FROM roles WHERE tenant_id = p_tenant_id;
  DELETE FROM departments WHERE tenant_id = p_tenant_id;
  
  -- 21. Company settings
  DELETE FROM company_settings WHERE tenant_id = p_tenant_id;
  
  -- 22. Tenant modules e config
  DELETE FROM tenant_modules WHERE tenant_id = p_tenant_id;
  DELETE FROM menu_items WHERE tenant_id = p_tenant_id;
  
  -- 23. Finalmente, deletar o tenant
  DELETE FROM tenants WHERE id = p_tenant_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'tenant_name', v_tenant_name,
    'message', 'Tenant "' || v_tenant_name || '" deletado com sucesso'
  );
END;
$$;