# 🚀 Guia de Migração Multi-Tenancy - CRM Space

Este documento contém todas as etapas para transformar o CRM Space em um sistema multi-tenant completo, separando os dados da Space Sports em seu próprio tenant.

---

## 📋 Índice

1. [FASE 1: Preparação e Criação do Tenant Space Sports](#fase-1)
2. [FASE 2: Migração de Dados](#fase-2)
3. [FASE 3: Remoção de Defaults Problemáticos](#fase-3)
4. [FASE 4: Ajuste de RLS para Super Admin](#fase-4)
5. [FASE 5: UI de Controle de Menu por Tenant (Lovable)](#fase-5)
6. [FASE 6: Validação e Testes](#fase-6)

---

## ⚠️ IMPORTANTE: Antes de Começar

1. **FAÇA BACKUP COMPLETO DO BANCO DE DADOS**
2. Execute em ambiente de staging/teste primeiro
3. Agende uma janela de manutenção (sistema offline)
4. Tenha um plano de rollback pronto

---

## FASE 1: Preparação e Criação do Tenant Space Sports {#fase-1}

### 1.1 Script SQL - Criar Tenant Space Sports

```sql
-- ============================================
-- FASE 1: CRIAÇÃO DO TENANT SPACE SPORTS
-- ============================================
-- Execute este script no Supabase SQL Editor
-- Data: ____/____/________
-- Responsável: ________________

-- 1.1 Verificar estado atual
SELECT
  'Dados no MASTER_TENANT' as info,
  (SELECT COUNT(*) FROM contacts WHERE tenant_id = '00000000-0000-0000-0000-000000000001') as contacts,
  (SELECT COUNT(*) FROM conversations WHERE tenant_id = '00000000-0000-0000-0000-000000000001') as conversations,
  (SELECT COUNT(*) FROM profiles WHERE tenant_id = '00000000-0000-0000-0000-000000000001') as profiles,
  (SELECT COUNT(*) FROM orders WHERE tenant_id = '00000000-0000-0000-0000-000000000001') as orders,
  (SELECT COUNT(*) FROM deals WHERE tenant_id = '00000000-0000-0000-0000-000000000001') as deals;

-- 1.2 Criar o Tenant Space Sports com UUID fixo (para facilitar referências)
-- UUID: 11111111-1111-1111-1111-111111111111 (Space Sports)
INSERT INTO public.tenants (
  id,
  name,
  slug,
  plan_type,
  max_users,
  max_contacts,
  is_active,
  settings,
  created_at,
  updated_at
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Space Sports',
  'space-sports',
  'enterprise',
  100,
  500000,
  true,
  '{"theme": "default", "features": {"whatsapp": true, "email": true, "crm": true}}'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- 1.3 Verificar criação
SELECT * FROM tenants WHERE slug = 'space-sports';

-- 1.4 Criar tenant_modules para Space Sports (todos os módulos habilitados)
INSERT INTO public.tenant_modules (tenant_id, module_key, is_enabled, created_at)
SELECT
  '11111111-1111-1111-1111-111111111111',
  module_key,
  true,
  NOW()
FROM (
  VALUES
    ('conversations'),
    ('crm'),
    ('contacts'),
    ('orders'),
    ('quotes'),
    ('products'),
    ('financial'),
    ('reports'),
    ('campaigns'),
    ('gamification'),
    ('automations'),
    ('bulk_dispatch'),
    ('internal_chat'),
    ('internal_email'),
    ('live_monitor'),
    ('webhooks'),
    ('dashboard'),
    ('settings')
) AS modules(module_key)
ON CONFLICT (tenant_id, module_key) DO NOTHING;

-- 1.5 Verificar módulos criados
SELECT * FROM tenant_modules WHERE tenant_id = '11111111-1111-1111-1111-111111111111';
```

### 1.2 Verificação Pós-Fase 1

```sql
-- Verificar se tenant foi criado corretamente
SELECT
  t.id,
  t.name,
  t.slug,
  t.plan_type,
  t.is_active,
  (SELECT COUNT(*) FROM tenant_modules WHERE tenant_id = t.id) as modules_count
FROM tenants t
WHERE t.slug = 'space-sports';
```

---

## FASE 2: Migração de Dados {#fase-2}

### 2.1 Script SQL - Migrar Dados do MASTER_TENANT para Space Sports

```sql
-- ============================================
-- FASE 2: MIGRAÇÃO DE DADOS PARA SPACE SPORTS
-- ============================================
-- ATENÇÃO: Execute em uma transação!
-- Se algo der errado, faça ROLLBACK

BEGIN;

-- Definir variáveis
DO $$
DECLARE
  v_master_tenant_id UUID := '00000000-0000-0000-0000-000000000001';
  v_space_sports_id UUID := '11111111-1111-1111-1111-111111111111';
  v_count INTEGER;
BEGIN

  -- ==========================================
  -- GRUPO 1: TABELAS DE USUÁRIOS
  -- ==========================================

  -- profiles
  UPDATE public.profiles
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'profiles: % registros migrados', v_count;

  -- user_departments
  UPDATE public.user_departments
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'user_departments: % registros migrados', v_count;

  -- user_invites
  UPDATE public.user_invites
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'user_invites: % registros migrados', v_count;

  -- user_quick_templates
  UPDATE public.user_quick_templates
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'user_quick_templates: % registros migrados', v_count;

  -- user_sessions
  UPDATE public.user_sessions
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'user_sessions: % registros migrados', v_count;

  -- ==========================================
  -- GRUPO 2: TABELAS DE COMUNICAÇÃO
  -- ==========================================

  -- contacts
  UPDATE public.contacts
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'contacts: % registros migrados', v_count;

  -- conversations
  UPDATE public.conversations
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'conversations: % registros migrados', v_count;

  -- messages
  UPDATE public.messages
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'messages: % registros migrados', v_count;

  -- scheduled_messages
  UPDATE public.scheduled_messages
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'scheduled_messages: % registros migrados', v_count;

  -- message_templates
  UPDATE public.message_templates
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'message_templates: % registros migrados', v_count;

  -- ==========================================
  -- GRUPO 3: TABELAS DE CRM/VENDAS
  -- ==========================================

  -- deals
  UPDATE public.deals
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'deals: % registros migrados', v_count;

  -- pipelines
  UPDATE public.pipelines
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'pipelines: % registros migrados', v_count;

  -- pipeline_stages
  UPDATE public.pipeline_stages
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'pipeline_stages: % registros migrados', v_count;

  -- orders
  UPDATE public.orders
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'orders: % registros migrados', v_count;

  -- order_items
  UPDATE public.order_items
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'order_items: % registros migrados', v_count;

  -- order_payments
  UPDATE public.order_payments
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'order_payments: % registros migrados', v_count;

  -- order_status_history
  UPDATE public.order_status_history
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'order_status_history: % registros migrados', v_count;

  -- order_statuses
  UPDATE public.order_statuses
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'order_statuses: % registros migrados', v_count;

  -- quotes
  UPDATE public.quotes
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'quotes: % registros migrados', v_count;

  -- quote_items
  UPDATE public.quote_items
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'quote_items: % registros migrados', v_count;

  -- ==========================================
  -- GRUPO 4: TABELAS DE PRODUTOS
  -- ==========================================

  -- products
  UPDATE public.products
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'products: % registros migrados', v_count;

  -- product_catalogs
  UPDATE public.product_catalogs
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'product_catalogs: % registros migrados', v_count;

  -- product_variations
  UPDATE public.product_variations
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'product_variations: % registros migrados', v_count;

  -- product_templates
  UPDATE public.product_templates
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'product_templates: % registros migrados', v_count;

  -- product_template_variations
  UPDATE public.product_template_variations
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'product_template_variations: % registros migrados', v_count;

  -- product_attributes
  UPDATE public.product_attributes
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'product_attributes: % registros migrados', v_count;

  -- product_attribute_types
  UPDATE public.product_attribute_types
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'product_attribute_types: % registros migrados', v_count;

  -- product_attribute_values
  UPDATE public.product_attribute_values
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'product_attribute_values: % registros migrados', v_count;

  -- product_attribute_price_rules
  UPDATE public.product_attribute_price_rules
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'product_attribute_price_rules: % registros migrados', v_count;

  -- inventory_movements
  UPDATE public.inventory_movements
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'inventory_movements: % registros migrados', v_count;

  -- stores
  UPDATE public.stores
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'stores: % registros migrados', v_count;

  -- ==========================================
  -- GRUPO 5: TABELAS FINANCEIRAS
  -- ==========================================

  -- financial_accounts
  UPDATE public.financial_accounts
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'financial_accounts: % registros migrados', v_count;

  -- financial_categories
  UPDATE public.financial_categories
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'financial_categories: % registros migrados', v_count;

  -- financial_transactions
  UPDATE public.financial_transactions
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'financial_transactions: % registros migrados', v_count;

  -- account_movements
  UPDATE public.account_movements
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'account_movements: % registros migrados', v_count;

  -- payment_links
  UPDATE public.payment_links
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'payment_links: % registros migrados', v_count;

  -- ==========================================
  -- GRUPO 6: TABELAS DE CONFIGURAÇÃO
  -- ==========================================

  -- departments
  UPDATE public.departments
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'departments: % registros migrados', v_count;

  -- role_definitions
  UPDATE public.role_definitions
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'role_definitions: % registros migrados', v_count;

  -- company_settings
  UPDATE public.company_settings
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'company_settings: % registros migrados', v_count;

  -- close_reasons
  UPDATE public.close_reasons
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'close_reasons: % registros migrados', v_count;

  -- lead_statuses
  UPDATE public.lead_statuses
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'lead_statuses: % registros migrados', v_count;

  -- tags
  UPDATE public.tags
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'tags: % registros migrados', v_count;

  -- segments
  UPDATE public.segments
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'segments: % registros migrados', v_count;

  -- whatsapp_channels
  UPDATE public.whatsapp_channels
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'whatsapp_channels: % registros migrados', v_count;

  -- whatsapp_providers
  UPDATE public.whatsapp_providers
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'whatsapp_providers: % registros migrados', v_count;

  -- ==========================================
  -- GRUPO 7: TABELAS DE AUTOMAÇÃO
  -- ==========================================

  -- chatbot_flows
  UPDATE public.chatbot_flows
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'chatbot_flows: % registros migrados', v_count;

  -- flow_nodes
  UPDATE public.flow_nodes
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'flow_nodes: % registros migrados', v_count;

  -- flow_connections
  UPDATE public.flow_connections
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'flow_connections: % registros migrados', v_count;

  -- flow_executions
  UPDATE public.flow_executions
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'flow_executions: % registros migrados', v_count;

  -- flow_execution_logs
  UPDATE public.flow_execution_logs
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'flow_execution_logs: % registros migrados', v_count;

  -- flow_node_templates
  UPDATE public.flow_node_templates
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'flow_node_templates: % registros migrados', v_count;

  -- bulk_dispatches
  UPDATE public.bulk_dispatches
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'bulk_dispatches: % registros migrados', v_count;

  -- bulk_dispatch_contacts
  UPDATE public.bulk_dispatch_contacts
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'bulk_dispatch_contacts: % registros migrados', v_count;

  -- rescue_templates
  UPDATE public.rescue_templates
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'rescue_templates: % registros migrados', v_count;

  -- rescue_scheduled_messages
  UPDATE public.rescue_scheduled_messages
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'rescue_scheduled_messages: % registros migrados', v_count;

  -- active_rescues
  UPDATE public.active_rescues
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'active_rescues: % registros migrados', v_count;

  -- ==========================================
  -- GRUPO 8: TABELAS DE EMAIL
  -- ==========================================

  -- internal_emails
  UPDATE public.internal_emails
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'internal_emails: % registros migrados', v_count;

  -- internal_email_recipients
  UPDATE public.internal_email_recipients
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'internal_email_recipients: % registros migrados', v_count;

  -- internal_email_attachments
  UPDATE public.internal_email_attachments
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'internal_email_attachments: % registros migrados', v_count;

  -- internal_email_labels
  UPDATE public.internal_email_labels
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'internal_email_labels: % registros migrados', v_count;

  -- email_shared_boxes
  UPDATE public.email_shared_boxes
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'email_shared_boxes: % registros migrados', v_count;

  -- email_shared_box_members
  UPDATE public.email_shared_box_members
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'email_shared_box_members: % registros migrados', v_count;

  -- email_visibility_rules
  UPDATE public.email_visibility_rules
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'email_visibility_rules: % registros migrados', v_count;

  -- email_activity_log
  UPDATE public.email_activity_log
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'email_activity_log: % registros migrados', v_count;

  -- ==========================================
  -- GRUPO 9: TABELAS DE LOGGING/TRACKING
  -- ==========================================

  -- activity_log
  UPDATE public.activity_log
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'activity_log: % registros migrados', v_count;

  -- conversation_events
  UPDATE public.conversation_events
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'conversation_events: % registros migrados', v_count;

  -- daily_metrics
  UPDATE public.daily_metrics
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'daily_metrics: % registros migrados', v_count;

  -- contact_tags
  UPDATE public.contact_tags
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'contact_tags: % registros migrados', v_count;

  -- conversation_tags
  UPDATE public.conversation_tags
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'conversation_tags: % registros migrados', v_count;

  -- deal_tags
  UPDATE public.deal_tags
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'deal_tags: % registros migrados', v_count;

  -- lead_status_history
  UPDATE public.lead_status_history
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'lead_status_history: % registros migrados', v_count;

  -- lead_assignment_history
  UPDATE public.lead_assignment_history
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'lead_assignment_history: % registros migrados', v_count;

  -- ==========================================
  -- GRUPO 10: TABELAS DE GAMIFICATION
  -- ==========================================

  -- gamification_profiles
  UPDATE public.gamification_profiles
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'gamification_profiles: % registros migrados', v_count;

  -- gamification_badges
  UPDATE public.gamification_badges
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'gamification_badges: % registros migrados', v_count;

  -- gamification_rankings
  UPDATE public.gamification_rankings
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'gamification_rankings: % registros migrados', v_count;

  -- gamification_badge_definitions
  UPDATE public.gamification_badge_definitions
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'gamification_badge_definitions: % registros migrados', v_count;

  -- gamification_events
  UPDATE public.gamification_events
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'gamification_events: % registros migrados', v_count;

  -- gamification_settings
  UPDATE public.gamification_settings
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'gamification_settings: % registros migrados', v_count;

  -- gamification_points
  UPDATE public.gamification_points
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'gamification_points: % registros migrados', v_count;

  -- ==========================================
  -- GRUPO 11: TABELAS DE INTEGRAÇÕES
  -- ==========================================

  -- meta_ad_accounts
  UPDATE public.meta_ad_accounts
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'meta_ad_accounts: % registros migrados', v_count;

  -- meta_campaigns
  UPDATE public.meta_campaigns
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'meta_campaigns: % registros migrados', v_count;

  -- meta_adsets
  UPDATE public.meta_adsets
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'meta_adsets: % registros migrados', v_count;

  -- meta_ads
  UPDATE public.meta_ads
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'meta_ads: % registros migrados', v_count;

  -- meta_campaign_insights
  UPDATE public.meta_campaign_insights
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'meta_campaign_insights: % registros migrados', v_count;

  -- webhook_configs
  UPDATE public.webhook_configs
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'webhook_configs: % registros migrados', v_count;

  -- webhook_deliveries
  UPDATE public.webhook_deliveries
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'webhook_deliveries: % registros migrados', v_count;

  -- webhook_logs
  UPDATE public.webhook_logs
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'webhook_logs: % registros migrados', v_count;

  -- ==========================================
  -- GRUPO 12: TABELAS AUXILIARES
  -- ==========================================

  -- custom_field_definitions
  UPDATE public.custom_field_definitions
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'custom_field_definitions: % registros migrados', v_count;

  -- space_memory
  UPDATE public.space_memory
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'space_memory: % registros migrados', v_count;

  -- template_folders
  UPDATE public.template_folders
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'template_folders: % registros migrados', v_count;

  -- queues
  UPDATE public.queues
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'queues: % registros migrados', v_count;

  -- queue_agents
  UPDATE public.queue_agents
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'queue_agents: % registros migrados', v_count;

  -- required_fields_rules
  UPDATE public.required_fields_rules
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'required_fields_rules: % registros migrados', v_count;

  -- ad_message_patterns
  UPDATE public.ad_message_patterns
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'ad_message_patterns: % registros migrados', v_count;

  -- availability_release_requests
  UPDATE public.availability_release_requests
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'availability_release_requests: % registros migrados', v_count;

  -- shared_conversations
  UPDATE public.shared_conversations
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'shared_conversations: % registros migrados', v_count;

  -- pinned_conversations
  UPDATE public.pinned_conversations
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'pinned_conversations: % registros migrados', v_count;

  -- contact_requests
  UPDATE public.contact_requests
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'contact_requests: % registros migrados', v_count;

  -- contact_merge_log
  UPDATE public.contact_merge_log
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'contact_merge_log: % registros migrados', v_count;

  -- import_history
  UPDATE public.import_history
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'import_history: % registros migrados', v_count;

  -- notification_settings
  UPDATE public.notification_settings
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'notification_settings: % registros migrados', v_count;

  -- tenant_notification_config
  UPDATE public.tenant_notification_config
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'tenant_notification_config: % registros migrados', v_count;

  -- quote_expiration_notifications
  UPDATE public.quote_expiration_notifications
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'quote_expiration_notifications: % registros migrados', v_count;

  -- call_logs
  UPDATE public.call_logs
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'call_logs: % registros migrados', v_count;

  -- call_results
  UPDATE public.call_results
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'call_results: % registros migrados', v_count;

  -- internal_chat_threads
  UPDATE public.internal_chat_threads
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'internal_chat_threads: % registros migrados', v_count;

  -- internal_chat_messages
  UPDATE public.internal_chat_messages
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'internal_chat_messages: % registros migrados', v_count;

  -- internal_chat_participants
  UPDATE public.internal_chat_participants
  SET tenant_id = v_space_sports_id
  WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'internal_chat_participants: % registros migrados', v_count;

  -- ==========================================
  -- NOTA: Tabelas que NÃO devem ser migradas:
  -- - menu_items (mantém no MASTER como catálogo base)
  -- - tenants (tabela de controle)
  -- - tenant_modules (já criados separadamente)
  -- - user_roles (roles globais)
  -- ==========================================

  RAISE NOTICE '========================================';
  RAISE NOTICE 'MIGRAÇÃO CONCLUÍDA COM SUCESSO!';
  RAISE NOTICE '========================================';

END $$;

-- Verificar resultado
SELECT
  'Dados migrados para Space Sports' as info,
  (SELECT COUNT(*) FROM contacts WHERE tenant_id = '11111111-1111-1111-1111-111111111111') as contacts,
  (SELECT COUNT(*) FROM conversations WHERE tenant_id = '11111111-1111-1111-1111-111111111111') as conversations,
  (SELECT COUNT(*) FROM profiles WHERE tenant_id = '11111111-1111-1111-1111-111111111111') as profiles,
  (SELECT COUNT(*) FROM orders WHERE tenant_id = '11111111-1111-1111-1111-111111111111') as orders;

-- Se tudo estiver OK:
COMMIT;

-- Se algo deu errado:
-- ROLLBACK;
```

### 2.2 Script de Rollback (Caso Precise Reverter)

```sql
-- ============================================
-- ROLLBACK: Reverter migração
-- ============================================
-- SOMENTE USE SE ALGO DEUR ERRADO!

BEGIN;

DO $$
DECLARE
  v_master_tenant_id UUID := '00000000-0000-0000-0000-000000000001';
  v_space_sports_id UUID := '11111111-1111-1111-1111-111111111111';
BEGIN
  -- Reverter TODAS as tabelas de volta para MASTER_TENANT
  UPDATE public.contacts SET tenant_id = v_master_tenant_id WHERE tenant_id = v_space_sports_id;
  UPDATE public.conversations SET tenant_id = v_master_tenant_id WHERE tenant_id = v_space_sports_id;
  UPDATE public.messages SET tenant_id = v_master_tenant_id WHERE tenant_id = v_space_sports_id;
  UPDATE public.profiles SET tenant_id = v_master_tenant_id WHERE tenant_id = v_space_sports_id;
  -- ... (adicionar todas as outras tabelas se necessário)

  -- Deletar tenant Space Sports
  DELETE FROM tenant_modules WHERE tenant_id = v_space_sports_id;
  DELETE FROM tenants WHERE id = v_space_sports_id;

  RAISE NOTICE 'ROLLBACK CONCLUÍDO';
END $$;

COMMIT;
```

---

## FASE 3: Remoção de Defaults Problemáticos {#fase-3}

### 3.1 Script SQL - Remover Defaults

```sql
-- ============================================
-- FASE 3: REMOVER DEFAULTS DE MASTER_TENANT
-- ============================================
-- Isso força a aplicação a sempre definir tenant_id explicitamente

-- GRUPO 1: Tabelas de usuários
ALTER TABLE public.profiles ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.user_departments ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.user_invites ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.user_quick_templates ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.user_sessions ALTER COLUMN tenant_id DROP DEFAULT;

-- GRUPO 2: Tabelas de comunicação
ALTER TABLE public.contacts ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.conversations ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.messages ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.scheduled_messages ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.message_templates ALTER COLUMN tenant_id DROP DEFAULT;

-- GRUPO 3: Tabelas de CRM/Vendas
ALTER TABLE public.deals ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.pipelines ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.pipeline_stages ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.orders ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.order_items ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.order_payments ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.order_status_history ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.order_statuses ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.quotes ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.quote_items ALTER COLUMN tenant_id DROP DEFAULT;

-- GRUPO 4: Tabelas de produtos
ALTER TABLE public.products ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.product_catalogs ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.product_variations ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.product_templates ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.product_template_variations ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.product_attributes ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.product_attribute_types ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.product_attribute_values ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.product_attribute_price_rules ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.inventory_movements ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.stores ALTER COLUMN tenant_id DROP DEFAULT;

-- GRUPO 5: Tabelas financeiras
ALTER TABLE public.financial_accounts ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.financial_categories ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.financial_transactions ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.account_movements ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.payment_links ALTER COLUMN tenant_id DROP DEFAULT;

-- GRUPO 6: Tabelas de configuração
ALTER TABLE public.departments ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.role_definitions ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.company_settings ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.close_reasons ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.lead_statuses ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.tags ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.segments ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.whatsapp_channels ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.whatsapp_providers ALTER COLUMN tenant_id DROP DEFAULT;

-- GRUPO 7: Tabelas de automação
ALTER TABLE public.chatbot_flows ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.flow_nodes ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.flow_connections ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.flow_executions ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.flow_execution_logs ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.flow_node_templates ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.bulk_dispatches ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.bulk_dispatch_contacts ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.rescue_templates ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.rescue_scheduled_messages ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.active_rescues ALTER COLUMN tenant_id DROP DEFAULT;

-- GRUPO 8: Tabelas de email
ALTER TABLE public.internal_emails ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.internal_email_recipients ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.internal_email_attachments ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.internal_email_labels ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.email_shared_boxes ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.email_shared_box_members ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.email_visibility_rules ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.email_activity_log ALTER COLUMN tenant_id DROP DEFAULT;

-- GRUPO 9: Tabelas de logging
ALTER TABLE public.activity_log ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.conversation_events ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.daily_metrics ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.contact_tags ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.conversation_tags ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.deal_tags ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.lead_status_history ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.lead_assignment_history ALTER COLUMN tenant_id DROP DEFAULT;

-- GRUPO 10: Tabelas de gamification
ALTER TABLE public.gamification_profiles ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.gamification_badges ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.gamification_rankings ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.gamification_badge_definitions ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.gamification_events ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.gamification_settings ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.gamification_points ALTER COLUMN tenant_id DROP DEFAULT;

-- GRUPO 11: Tabelas de integrações
ALTER TABLE public.meta_ad_accounts ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.meta_campaigns ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.meta_adsets ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.meta_ads ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.meta_campaign_insights ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.webhook_configs ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.webhook_deliveries ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.webhook_logs ALTER COLUMN tenant_id DROP DEFAULT;

-- GRUPO 12: Tabelas auxiliares
ALTER TABLE public.custom_field_definitions ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.space_memory ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.template_folders ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.queues ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.queue_agents ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.required_fields_rules ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.ad_message_patterns ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.availability_release_requests ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.shared_conversations ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.pinned_conversations ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.contact_requests ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.contact_merge_log ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.import_history ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.notification_settings ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.tenant_notification_config ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.quote_expiration_notifications ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.call_logs ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.call_results ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.internal_chat_threads ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.internal_chat_messages ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.internal_chat_participants ALTER COLUMN tenant_id DROP DEFAULT;

-- NOTA: menu_items MANTÉM o default pois é usado como catálogo base
-- ALTER TABLE public.menu_items ALTER COLUMN tenant_id DROP DEFAULT;
```

---

## FASE 4: Ajuste de RLS para Super Admin {#fase-4}

### 4.1 Script SQL - Adicionar Bypass para Super Admin

```sql
-- ============================================
-- FASE 4: AJUSTAR RLS PARA SUPER ADMIN
-- ============================================
-- Adiciona bypass para Super Admin em tabelas críticas

-- Função auxiliar para verificar Super Admin (se não existir)
CREATE OR REPLACE FUNCTION public.current_user_is_super_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
  );
END;
$$;

-- Atualizar políticas para tabelas críticas que o Super Admin precisa visualizar

-- CONTACTS - Super Admin pode ver todos
DROP POLICY IF EXISTS "super_admin_bypass_contacts" ON public.contacts;
CREATE POLICY "super_admin_bypass_contacts" ON public.contacts
FOR ALL
TO authenticated
USING (
  tenant_id = get_user_tenant_id()
  OR current_user_is_super_admin()
);

-- CONVERSATIONS - Super Admin pode ver todos
DROP POLICY IF EXISTS "super_admin_bypass_conversations" ON public.conversations;
CREATE POLICY "super_admin_bypass_conversations" ON public.conversations
FOR ALL
TO authenticated
USING (
  tenant_id = get_user_tenant_id()
  OR current_user_is_super_admin()
);

-- PROFILES - Super Admin pode ver todos
DROP POLICY IF EXISTS "super_admin_bypass_profiles" ON public.profiles;
CREATE POLICY "super_admin_bypass_profiles" ON public.profiles
FOR ALL
TO authenticated
USING (
  tenant_id = get_user_tenant_id()
  OR current_user_is_super_admin()
);

-- ORDERS - Super Admin pode ver todos
DROP POLICY IF EXISTS "super_admin_bypass_orders" ON public.orders;
CREATE POLICY "super_admin_bypass_orders" ON public.orders
FOR ALL
TO authenticated
USING (
  tenant_id = get_user_tenant_id()
  OR current_user_is_super_admin()
);

-- DEALS - Super Admin pode ver todos
DROP POLICY IF EXISTS "super_admin_bypass_deals" ON public.deals;
CREATE POLICY "super_admin_bypass_deals" ON public.deals
FOR ALL
TO authenticated
USING (
  tenant_id = get_user_tenant_id()
  OR current_user_is_super_admin()
);

-- PRODUCTS - Super Admin pode ver todos
DROP POLICY IF EXISTS "super_admin_bypass_products" ON public.products;
CREATE POLICY "super_admin_bypass_products" ON public.products
FOR ALL
TO authenticated
USING (
  tenant_id = get_user_tenant_id()
  OR current_user_is_super_admin()
);

-- FINANCIAL_TRANSACTIONS - Super Admin pode ver todos
DROP POLICY IF EXISTS "super_admin_bypass_financial_transactions" ON public.financial_transactions;
CREATE POLICY "super_admin_bypass_financial_transactions" ON public.financial_transactions
FOR ALL
TO authenticated
USING (
  tenant_id = get_user_tenant_id()
  OR current_user_is_super_admin()
);

-- DEPARTMENTS - Super Admin pode ver todos
DROP POLICY IF EXISTS "super_admin_bypass_departments" ON public.departments;
CREATE POLICY "super_admin_bypass_departments" ON public.departments
FOR ALL
TO authenticated
USING (
  tenant_id = get_user_tenant_id()
  OR current_user_is_super_admin()
);

-- MENU_ITEMS - Super Admin pode ver todos (importante para gestão de menus)
DROP POLICY IF EXISTS "super_admin_bypass_menu_items" ON public.menu_items;
CREATE POLICY "super_admin_bypass_menu_items" ON public.menu_items
FOR ALL
TO authenticated
USING (
  tenant_id = get_user_tenant_id()
  OR current_user_is_super_admin()
);

-- Verificar políticas criadas
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE policyname LIKE 'super_admin_bypass%'
ORDER BY tablename;
```

### 4.2 Atualizar função get_user_tenant_id para Super Admin

```sql
-- ============================================
-- ATUALIZAR FUNÇÃO get_user_tenant_id
-- ============================================
-- Permite que Super Admin trabalhe com qualquer tenant

CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_tenant_id UUID;
  v_is_super_admin BOOLEAN;
BEGIN
  -- Verificar se é Super Admin
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
  ) INTO v_is_super_admin;

  -- Se for Super Admin, pode usar qualquer tenant (definido por sessão ou retorna master)
  IF v_is_super_admin THEN
    -- Tentar pegar tenant da sessão (se definido)
    v_tenant_id := NULLIF(current_setting('app.current_tenant_id', true), '')::UUID;
    IF v_tenant_id IS NOT NULL THEN
      RETURN v_tenant_id;
    END IF;
  END IF;

  -- Para usuários normais, retorna o tenant do profile
  SELECT tenant_id INTO v_tenant_id
  FROM public.profiles
  WHERE id = auth.uid();

  RETURN v_tenant_id;
END;
$$;
```

---

## FASE 5: UI de Controle de Menu por Tenant (Lovable) {#fase-5}

### 5.1 Prompt 1 - Criar Editor de Menu por Tenant

```
PROMPT PARA LOVABLE - PARTE 1/3

Contexto: Estou desenvolvendo um CRM multi-tenant onde o Super Admin precisa controlar quais itens de menu cada tenant pode acessar.

Tarefa: Criar um componente TenantMenuEditor que permita ao Super Admin:

1. Ver todos os itens de menu disponíveis (catálogo base do MASTER_TENANT)
2. Para cada tenant, habilitar/desabilitar itens de menu individualmente
3. Interface com árvore hierárquica (menus com submenus)
4. Switch toggle para cada item de menu
5. Botões "Marcar Todos" e "Desmarcar Todos"
6. Indicador visual de quantos itens estão habilitados

Componentes existentes a reutilizar:
- TenantModulesTree.tsx (tem lógica similar, use como referência)
- useBaseMenuConfig.ts (hook que busca menu base)
- Switch, Button, Badge do shadcn/ui

Criar em: src/components/super-admin/TenantMenuEditor.tsx

Estrutura esperada:
- Props: tenantId, onSave
- Usa useBaseMenuHierarchy() para buscar menu base
- Armazena estado local dos itens habilitados
- Salva alterações via RPC update_tenant_menu_items()

Design:
- Usar cards com fundo muted/30 para itens de nível 0
- Indentação visual para submenus
- Ícones Lucide para cada item (já vem do menu)
- Contador de itens habilitados no header
```

### 5.2 Prompt 2 - Adicionar Aba de Menu no TenantDetailsModal

```
PROMPT PARA LOVABLE - PARTE 2/3

Contexto: O TenantDetailsModal.tsx já existe com 3 abas (Empresa, Administrador, Módulos). Preciso adicionar uma 4ª aba para controle de Menu.

Tarefa: Modificar TenantDetailsModal.tsx para adicionar aba "Menu":

1. Adicionar nova aba "Menu" com ícone Menu (Lucide)
2. Integrar o componente TenantMenuEditor na nova aba
3. Mostrar badge com quantidade de menus habilitados
4. Salvar alterações de menu junto com as outras alterações

Arquivo: src/components/super-admin/TenantDetailsModal.tsx

Alterações necessárias:
- Importar TenantMenuEditor
- Adicionar TabsTrigger para "menu"
- Adicionar TabsContent para "menu"
- State para selectedMenuItems
- Incluir menu na função handleSave

Referência visual:
- Seguir mesmo padrão das outras abas
- Ícone: Menu do Lucide
- Badge mostrando count de menus habilitados
```

### 5.3 Prompt 3 - Criar Funções RPC para Menu por Tenant

```
PROMPT PARA LOVABLE - PARTE 3/3

Contexto: Preciso de funções SQL no Supabase para gerenciar menus por tenant.

Tarefa: Criar migration com as seguintes funções:

1. get_tenant_menu_items(p_tenant_id UUID)
   - Retorna todos os menu_items do tenant específico
   - Inclui campo is_enabled
   - Ordena por position

2. update_tenant_menu_items(p_tenant_id UUID, p_menu_items UUID[])
   - Recebe array de IDs de menu_items que devem estar habilitados
   - Atualiza is_active = true para os IDs recebidos
   - Atualiza is_active = false para os demais
   - Retorna quantidade de itens atualizados

3. copy_menu_from_base_to_tenant(p_tenant_id UUID)
   - Copia todos os menu_items do MASTER_TENANT para o tenant
   - Não duplica se já existir (merge)
   - Mantém estrutura hierárquica (parent_id)

Arquivo: supabase/migrations/[timestamp]_tenant_menu_management.sql

Segurança:
- Todas as funções verificam current_user_is_super_admin()
- SECURITY DEFINER para bypass RLS
- Retornar erro se não for Super Admin
```

### 5.4 Prompt 4 - Hook React para Menu por Tenant

```
PROMPT PARA LOVABLE - PARTE 4/4

Contexto: Preciso de hooks React para conectar a UI com as funções RPC de menu.

Tarefa: Criar hook useTenantMenu.ts com:

1. useTenantMenuItems(tenantId)
   - Query que busca menu_items do tenant
   - Retorna { data, isLoading, error, refetch }

2. useUpdateTenantMenu()
   - Mutation para atualizar menus do tenant
   - Parâmetros: { tenantId, enabledMenuIds }
   - Invalidar cache após sucesso
   - Toast de sucesso/erro

3. useCopyMenuToTenant()
   - Mutation para copiar menu base para tenant
   - Parâmetro: tenantId
   - Toast de sucesso com quantidade copiada

Arquivo: src/hooks/useTenantMenu.ts

Dependências:
- @tanstack/react-query
- sonner (toast)
- supabase client

Padrão a seguir:
- Mesmo padrão de useSuperAdminTenants.ts
- Tratamento de erros consistente
- Logs de console para debug
```

---

## FASE 6: Validação e Testes {#fase-6}

### 6.1 Checklist de Validação

```
□ FASE 1 - Tenant Space Sports criado
  □ Tenant existe na tabela tenants
  □ Tenant tem todos os módulos habilitados
  □ Slug é "space-sports"
  □ Plan type é "enterprise"

□ FASE 2 - Dados migrados corretamente
  □ Nenhum dado restante no MASTER_TENANT (exceto menu_items)
  □ Todos os contatos estão no tenant Space Sports
  □ Todas as conversas estão no tenant Space Sports
  □ Todos os pedidos estão no tenant Space Sports
  □ Todos os usuários estão no tenant Space Sports

□ FASE 3 - Defaults removidos
  □ Testar inserção sem tenant_id (deve falhar)
  □ Testar inserção com tenant_id (deve funcionar)

□ FASE 4 - RLS para Super Admin
  □ Super Admin consegue ver dados de todos os tenants
  □ Usuário normal só vê dados do seu tenant
  □ Não há vazamento de dados entre tenants

□ FASE 5 - UI de Menu
  □ Editor de menu aparece no modal de tenant
  □ Consegue habilitar/desabilitar menus
  □ Alterações são salvas corretamente
  □ Tenant vê apenas menus habilitados

□ GERAL
  □ Login funciona para usuários Space Sports
  □ Dashboard carrega corretamente
  □ Não há erros no console
  □ Performance está adequada
```

### 6.2 Queries de Verificação

```sql
-- Verificar distribuição de dados por tenant
SELECT
  t.name as tenant,
  (SELECT COUNT(*) FROM contacts WHERE tenant_id = t.id) as contacts,
  (SELECT COUNT(*) FROM conversations WHERE tenant_id = t.id) as conversations,
  (SELECT COUNT(*) FROM profiles WHERE tenant_id = t.id) as users,
  (SELECT COUNT(*) FROM orders WHERE tenant_id = t.id) as orders,
  (SELECT COUNT(*) FROM deals WHERE tenant_id = t.id) as deals,
  (SELECT COUNT(*) FROM products WHERE tenant_id = t.id) as products
FROM tenants t
ORDER BY t.name;

-- Verificar se há dados órfãos (sem tenant válido)
SELECT 'contacts' as tabela, COUNT(*) as orfaos
FROM contacts c
WHERE NOT EXISTS (SELECT 1 FROM tenants t WHERE t.id = c.tenant_id)
UNION ALL
SELECT 'conversations', COUNT(*)
FROM conversations c
WHERE NOT EXISTS (SELECT 1 FROM tenants t WHERE t.id = c.tenant_id)
UNION ALL
SELECT 'profiles', COUNT(*)
FROM profiles p
WHERE NOT EXISTS (SELECT 1 FROM tenants t WHERE t.id = p.tenant_id);

-- Verificar Super Admins
SELECT
  p.full_name,
  p.email,
  ur.role,
  t.name as tenant
FROM user_roles ur
JOIN profiles p ON p.id = ur.user_id
LEFT JOIN tenants t ON t.id = p.tenant_id
WHERE ur.role = 'super_admin';
```

---

## 📝 Notas Importantes

1. **Backup**: Sempre faça backup antes de executar qualquer script
2. **Staging**: Teste em ambiente de staging antes de produção
3. **Horário**: Execute em horário de baixo uso
4. **Monitoramento**: Acompanhe logs durante e após a migração
5. **Rollback**: Tenha o script de rollback pronto para uso imediato

---

## 🔗 Arquivos Relacionados

- `/src/components/super-admin/` - Componentes do Super Admin
- `/src/hooks/useSuperAdminTenants.ts` - Hooks de gerenciamento
- `/src/hooks/useBaseMenuConfig.ts` - Hooks de menu base
- `/supabase/migrations/` - Migrations do banco

---

**Última atualização:** 24/12/2024
**Autor:** Claude (AI Assistant)
**Versão:** 1.0
