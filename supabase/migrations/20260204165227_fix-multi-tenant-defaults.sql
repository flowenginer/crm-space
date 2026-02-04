-- =========================================================================
-- CORREÇÃO DE MULTI-TENANCY: Remover DEFAULT hardcoded para Space Sports
-- =========================================================================
-- Este migration corrige o problema onde tabelas tinham DEFAULT para o tenant
-- Space Sports (00000000-0000-0000-0000-000000000001), causando bugs quando
-- registros eram criados para outros tenants sem especificar tenant_id.
--
-- SOLUÇÃO:
-- 1. Remover todos os DEFAULT hardcoded
-- 2. Criar função helper para obter tenant_id do contexto
-- 3. Criar trigger genérico para auto-preencher tenant_id
-- 4. Aplicar trigger em todas as tabelas relevantes
-- =========================================================================

-- =========================================================================
-- PARTE 1: Função helper para obter tenant_id do contexto atual
-- =========================================================================

CREATE OR REPLACE FUNCTION public.get_current_tenant_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  -- Primeiro tentar obter do usuário autenticado via profile
  SELECT tenant_id INTO v_tenant_id
  FROM profiles
  WHERE id = auth.uid();

  IF v_tenant_id IS NOT NULL THEN
    RETURN v_tenant_id;
  END IF;

  -- Se não encontrou (ex: service_role sem contexto de usuário), retornar NULL
  -- Neste caso, o código chamador DEVE fornecer tenant_id explicitamente
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.get_current_tenant_id() IS
'Retorna o tenant_id do usuário autenticado atual.
Retorna NULL para service_role sem contexto de usuário - nesse caso o código deve fornecer tenant_id explicitamente.';

-- =========================================================================
-- PARTE 2: Trigger function genérica para auto-preencher tenant_id
-- =========================================================================

CREATE OR REPLACE FUNCTION public.set_tenant_id_from_context()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  -- Se tenant_id já foi fornecido explicitamente, usar esse valor
  IF NEW.tenant_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Tentar obter do contexto do usuário autenticado
  v_tenant_id := public.get_current_tenant_id();

  IF v_tenant_id IS NOT NULL THEN
    NEW.tenant_id := v_tenant_id;
    RETURN NEW;
  END IF;

  -- Se chegou aqui, não há contexto de tenant
  -- Para service_role, isso é um erro - deve fornecer tenant_id
  RAISE EXCEPTION 'tenant_id é obrigatório. Forneça explicitamente ou autentique como usuário.';
END;
$$;

COMMENT ON FUNCTION public.set_tenant_id_from_context() IS
'Trigger function que auto-preenche tenant_id baseado no usuário autenticado.
Se tenant_id já foi fornecido, mantém o valor. Se não, tenta obter do profile do usuário.
Para service_role sem tenant_id explícito, lança exceção.';

-- =========================================================================
-- PARTE 3: Remover DEFAULT hardcoded de Space Sports das tabelas
-- =========================================================================

-- CONTACTS
ALTER TABLE public.contacts ALTER COLUMN tenant_id DROP DEFAULT;

-- CONVERSATIONS
ALTER TABLE public.conversations ALTER COLUMN tenant_id DROP DEFAULT;

-- MESSAGES
ALTER TABLE public.messages ALTER COLUMN tenant_id DROP DEFAULT;

-- WHATSAPP_CHANNELS
ALTER TABLE public.whatsapp_channels ALTER COLUMN tenant_id DROP DEFAULT;

-- DEPARTMENTS
ALTER TABLE public.departments ALTER COLUMN tenant_id DROP DEFAULT;

-- TAGS
ALTER TABLE public.tags ALTER COLUMN tenant_id DROP DEFAULT;

-- LEAD_STATUSES
ALTER TABLE public.lead_statuses ALTER COLUMN tenant_id DROP DEFAULT;

-- SEGMENTS
ALTER TABLE public.segments ALTER COLUMN tenant_id DROP DEFAULT;

-- INTERNAL_NOTES
ALTER TABLE public.internal_notes ALTER COLUMN tenant_id DROP DEFAULT;

-- CONVERSATION_EVENTS
ALTER TABLE public.conversation_events ALTER COLUMN tenant_id DROP DEFAULT;

-- DAILY_METRICS
ALTER TABLE public.daily_metrics ALTER COLUMN tenant_id DROP DEFAULT;

-- LEAD_STATUS_HISTORY
ALTER TABLE public.lead_status_history ALTER COLUMN tenant_id DROP DEFAULT;

-- LEAD_ASSIGNMENT_HISTORY
ALTER TABLE public.lead_assignment_history ALTER COLUMN tenant_id DROP DEFAULT;

-- SCHEDULED_MESSAGES
ALTER TABLE public.scheduled_messages ALTER COLUMN tenant_id DROP DEFAULT;

-- META_AD_ACCOUNTS
ALTER TABLE public.meta_ad_accounts ALTER COLUMN tenant_id DROP DEFAULT;

-- META_CAMPAIGNS
ALTER TABLE public.meta_campaigns ALTER COLUMN tenant_id DROP DEFAULT;

-- FLOW_NODES
ALTER TABLE public.flow_nodes ALTER COLUMN tenant_id DROP DEFAULT;

-- ORDER_STATUSES
ALTER TABLE public.order_statuses ALTER COLUMN tenant_id DROP DEFAULT;

-- REQUIRED_FIELDS_RULES
ALTER TABLE public.required_fields_rules ALTER COLUMN tenant_id DROP DEFAULT;

-- PAYMENT_LINKS
ALTER TABLE public.payment_links ALTER COLUMN tenant_id DROP DEFAULT;

-- NOTIFICATION_SETTINGS
ALTER TABLE public.notification_settings ALTER COLUMN tenant_id DROP DEFAULT;

-- GAMIFICATION_BADGES
ALTER TABLE public.gamification_badges ALTER COLUMN tenant_id DROP DEFAULT;

-- GAMIFICATION_BADGE_DEFINITIONS
ALTER TABLE public.gamification_badge_definitions ALTER COLUMN tenant_id DROP DEFAULT;

-- ACTIVITY_LOG
ALTER TABLE public.activity_log ALTER COLUMN tenant_id DROP DEFAULT;

-- BULK_DISPATCH_CONTACTS
ALTER TABLE public.bulk_dispatch_contacts ALTER COLUMN tenant_id DROP DEFAULT;

-- CONTACT_MERGE_LOG
ALTER TABLE public.contact_merge_log ALTER COLUMN tenant_id DROP DEFAULT;

-- CONTACT_REQUESTS
ALTER TABLE public.contact_requests ALTER COLUMN tenant_id DROP DEFAULT;

-- CONTACT_TAGS
ALTER TABLE public.contact_tags ALTER COLUMN tenant_id DROP DEFAULT;

-- CONVERSATION_TAGS
ALTER TABLE public.conversation_tags ALTER COLUMN tenant_id DROP DEFAULT;

-- DEAL_TAGS
ALTER TABLE public.deal_tags ALTER COLUMN tenant_id DROP DEFAULT;

-- EMAIL_ACTIVITY_LOG
ALTER TABLE public.email_activity_log ALTER COLUMN tenant_id DROP DEFAULT;

-- PRODUCT_ATTRIBUTES
ALTER TABLE public.product_attributes ALTER COLUMN tenant_id DROP DEFAULT;

-- QUEUE_AGENTS
ALTER TABLE public.queue_agents ALTER COLUMN tenant_id DROP DEFAULT;

-- EMAIL_SHARED_BOXES
ALTER TABLE public.email_shared_boxes ALTER COLUMN tenant_id DROP DEFAULT;

-- EMAIL_SHARED_BOX_MEMBERS
ALTER TABLE public.email_shared_box_members ALTER COLUMN tenant_id DROP DEFAULT;

-- EMAIL_VISIBILITY_RULES
ALTER TABLE public.email_visibility_rules ALTER COLUMN tenant_id DROP DEFAULT;

-- INTERNAL_EMAIL_ATTACHMENTS
ALTER TABLE public.internal_email_attachments ALTER COLUMN tenant_id DROP DEFAULT;

-- INTERNAL_EMAIL_LABELS
ALTER TABLE public.internal_email_labels ALTER COLUMN tenant_id DROP DEFAULT;

-- INTERNAL_EMAIL_RECIPIENTS
ALTER TABLE public.internal_email_recipients ALTER COLUMN tenant_id DROP DEFAULT;

-- MENU_ITEMS
ALTER TABLE public.menu_items ALTER COLUMN tenant_id DROP DEFAULT;

-- TEMPLATE_FOLDERS
ALTER TABLE public.template_folders ALTER COLUMN tenant_id DROP DEFAULT;

-- USER_QUICK_TEMPLATES
ALTER TABLE public.user_quick_templates ALTER COLUMN tenant_id DROP DEFAULT;

-- WHATSAPP_PROVIDERS
ALTER TABLE public.whatsapp_providers ALTER COLUMN tenant_id DROP DEFAULT;

-- AVAILABILITY_RELEASE_REQUESTS
ALTER TABLE public.availability_release_requests ALTER COLUMN tenant_id DROP DEFAULT;

-- USER_INVITES
ALTER TABLE public.user_invites ALTER COLUMN tenant_id DROP DEFAULT;

-- BULK_DISPATCHES
ALTER TABLE public.bulk_dispatches ALTER COLUMN tenant_id DROP DEFAULT;

-- CHATBOT_FLOWS
ALTER TABLE public.chatbot_flows ALTER COLUMN tenant_id DROP DEFAULT;

-- MESSAGE_TEMPLATES
ALTER TABLE public.message_templates ALTER COLUMN tenant_id DROP DEFAULT;

-- DEALS
ALTER TABLE public.deals ALTER COLUMN tenant_id DROP DEFAULT;

-- PIPELINES
ALTER TABLE public.pipelines ALTER COLUMN tenant_id DROP DEFAULT;

-- PIPELINE_STAGES
ALTER TABLE public.pipeline_stages ALTER COLUMN tenant_id DROP DEFAULT;

-- RESCUE_TEMPLATES
ALTER TABLE public.rescue_templates ALTER COLUMN tenant_id DROP DEFAULT;

-- ACTIVE_RESCUES
ALTER TABLE public.active_rescues ALTER COLUMN tenant_id DROP DEFAULT;

-- IMPORT_HISTORY
ALTER TABLE public.import_history ALTER COLUMN tenant_id DROP DEFAULT;

-- RESCUE_SCHEDULED_MESSAGES
ALTER TABLE public.rescue_scheduled_messages ALTER COLUMN tenant_id DROP DEFAULT;

-- INTERNAL_CHAT_MESSAGES
ALTER TABLE public.internal_chat_messages ALTER COLUMN tenant_id DROP DEFAULT;

-- INTERNAL_CHAT_THREADS
ALTER TABLE public.internal_chat_threads ALTER COLUMN tenant_id DROP DEFAULT;

-- INTERNAL_CHAT_PARTICIPANTS
ALTER TABLE public.internal_chat_participants ALTER COLUMN tenant_id DROP DEFAULT;

-- GAMIFICATION_EVENTS
ALTER TABLE public.gamification_events ALTER COLUMN tenant_id DROP DEFAULT;

-- GAMIFICATION_POINTS
ALTER TABLE public.gamification_points ALTER COLUMN tenant_id DROP DEFAULT;

-- GAMIFICATION_PROFILES
ALTER TABLE public.gamification_profiles ALTER COLUMN tenant_id DROP DEFAULT;

-- META_ADS
ALTER TABLE public.meta_ads ALTER COLUMN tenant_id DROP DEFAULT;

-- META_ADSETS
ALTER TABLE public.meta_adsets ALTER COLUMN tenant_id DROP DEFAULT;

-- META_CAMPAIGN_INSIGHTS
ALTER TABLE public.meta_campaign_insights ALTER COLUMN tenant_id DROP DEFAULT;

-- FLOW_CONNECTIONS
ALTER TABLE public.flow_connections ALTER COLUMN tenant_id DROP DEFAULT;

-- FLOW_EXECUTIONS
ALTER TABLE public.flow_executions ALTER COLUMN tenant_id DROP DEFAULT;

-- FLOW_EXECUTION_LOGS
ALTER TABLE public.flow_execution_logs ALTER COLUMN tenant_id DROP DEFAULT;

-- FLOW_NODE_TEMPLATES
ALTER TABLE public.flow_node_templates ALTER COLUMN tenant_id DROP DEFAULT;

-- SHARED_CONVERSATIONS
ALTER TABLE public.shared_conversations ALTER COLUMN tenant_id DROP DEFAULT;

-- PINNED_CONVERSATIONS
ALTER TABLE public.pinned_conversations ALTER COLUMN tenant_id DROP DEFAULT;

-- GAMIFICATION_RANKINGS
ALTER TABLE public.gamification_rankings ALTER COLUMN tenant_id DROP DEFAULT;

-- GAMIFICATION_SETTINGS
ALTER TABLE public.gamification_settings ALTER COLUMN tenant_id DROP DEFAULT;

-- CLOSE_REASONS
ALTER TABLE public.close_reasons ALTER COLUMN tenant_id DROP DEFAULT;

-- CALL_RESULTS
ALTER TABLE public.call_results ALTER COLUMN tenant_id DROP DEFAULT;

-- CALL_LOGS
ALTER TABLE public.call_logs ALTER COLUMN tenant_id DROP DEFAULT;

-- COMPANY_SETTINGS
ALTER TABLE public.company_settings ALTER COLUMN tenant_id DROP DEFAULT;

-- CUSTOM_FIELD_DEFINITIONS
ALTER TABLE public.custom_field_definitions ALTER COLUMN tenant_id DROP DEFAULT;

-- AD_MESSAGE_PATTERNS
ALTER TABLE public.ad_message_patterns ALTER COLUMN tenant_id DROP DEFAULT;

-- WEBHOOK_CONFIGS
ALTER TABLE public.webhook_configs ALTER COLUMN tenant_id DROP DEFAULT;

-- QUEUES
ALTER TABLE public.queues ALTER COLUMN tenant_id DROP DEFAULT;

-- ROLE_DEFINITIONS
ALTER TABLE public.role_definitions ALTER COLUMN tenant_id DROP DEFAULT;

-- SPACE_MEMORY
ALTER TABLE public.space_memory ALTER COLUMN tenant_id DROP DEFAULT;

-- USER_SESSIONS
ALTER TABLE public.user_sessions ALTER COLUMN tenant_id DROP DEFAULT;

-- WEBHOOK_DELIVERIES
ALTER TABLE public.webhook_deliveries ALTER COLUMN tenant_id DROP DEFAULT;

-- WEBHOOK_LOGS
ALTER TABLE public.webhook_logs ALTER COLUMN tenant_id DROP DEFAULT;

-- USER_DEPARTMENTS
ALTER TABLE public.user_departments ALTER COLUMN tenant_id DROP DEFAULT;

-- =========================================================================
-- PARTE 4: Criar triggers para auto-preencher tenant_id nas tabelas principais
-- =========================================================================

-- Função para criar trigger de forma segura (ignorando se já existe)
CREATE OR REPLACE FUNCTION public.create_tenant_trigger_if_not_exists(p_table_name TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_trigger_name TEXT;
BEGIN
  v_trigger_name := 'trg_set_tenant_id_' || p_table_name;

  -- Tentar dropar se existir
  EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', v_trigger_name, p_table_name);

  -- Criar o trigger
  EXECUTE format('
    CREATE TRIGGER %I
    BEFORE INSERT ON public.%I
    FOR EACH ROW
    EXECUTE FUNCTION public.set_tenant_id_from_context()
  ', v_trigger_name, p_table_name);
END;
$$;

-- Aplicar triggers nas tabelas mais críticas
SELECT public.create_tenant_trigger_if_not_exists('contacts');
SELECT public.create_tenant_trigger_if_not_exists('conversations');
SELECT public.create_tenant_trigger_if_not_exists('messages');
SELECT public.create_tenant_trigger_if_not_exists('internal_notes');
SELECT public.create_tenant_trigger_if_not_exists('conversation_events');
SELECT public.create_tenant_trigger_if_not_exists('lead_status_history');
SELECT public.create_tenant_trigger_if_not_exists('lead_assignment_history');
SELECT public.create_tenant_trigger_if_not_exists('contact_tags');
SELECT public.create_tenant_trigger_if_not_exists('flow_executions');
SELECT public.create_tenant_trigger_if_not_exists('flow_execution_logs');
SELECT public.create_tenant_trigger_if_not_exists('scheduled_messages');
SELECT public.create_tenant_trigger_if_not_exists('activity_log');
SELECT public.create_tenant_trigger_if_not_exists('daily_metrics');

-- Limpar função auxiliar
DROP FUNCTION IF EXISTS public.create_tenant_trigger_if_not_exists(TEXT);

-- =========================================================================
-- PARTE 5: Comentário final
-- =========================================================================

COMMENT ON SCHEMA public IS
'Schema público do CRM com suporte multi-tenant.
IMPORTANTE: Todas as Edge Functions devem SEMPRE fornecer tenant_id explicitamente,
pois elas usam service_role que não tem contexto de usuário autenticado.';
