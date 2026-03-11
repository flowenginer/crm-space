# CRM Space - API Reference

> **Supabase Project:** `lkxrmjqrzhaivviuuamp`
> **Repo:** `flowenginer/crm-space`
> **Stack:** React + Vite + Supabase + Tailwind
> **Base Tenant:** `00000000-0000-0000-0000-000000000001`
> **Atualizado:** 2026-03-11

---

## Sumário

- [Edge Functions](#edge-functions)
- [SQL Functions (RPC)](#sql-functions-rpc)
- [Database Schema (Tabelas Principais)](#database-schema)
- [Fluxos Importantes](#fluxos-importantes)

---

## Edge Functions

Todas as Edge Functions rodam em Deno no Supabase. URL base: `https://lkxrmjqrzhaivviuuamp.supabase.co/functions/v1/`

### WhatsApp / Mensagens

| Slug | Descrição | Auth |
|------|-----------|------|
| `whatsapp-webhook` | Recebe webhooks da Evolution API (mensagens, status, etc) | No JWT |
| `cloudapi-webhook` | Recebe webhooks da Cloud API (Meta oficial) | No JWT |
| `cloudapi-send-message` | Envia mensagem via Cloud API | JWT |
| `cloudapi-initiate-call` | Inicia chamada via Cloud API | JWT |
| `cloudapi-call-action` | Ações de chamada (atender, desligar) | JWT |
| `cloudapi-check-calling-status` | Verifica status de chamadas | JWT |
| `cloudapi-enable-calling` | Habilita chamadas no número | JWT |
| `cloudapi-send-call-permission-request` | Envia pedido de permissão de chamada | JWT |
| `cloudapi-register-phone` | Registra número na Cloud API | JWT |
| `cloudapi-manual-connect` | Conexão manual Cloud API | No JWT |
| `cloudapi-test-webhook` | Testa webhook da Cloud API | No JWT |
| `whatsapp-instance` | Gerencia instâncias WhatsApp (Evolution API) | JWT |
| `whatsapp-embedded-signup` | Fluxo de signup embarcado Meta | No JWT |
| `sync-whatsapp-channels` | Sincroniza canais WhatsApp | No JWT |
| `api-send-message` | API pública para envio de mensagens | No JWT |
| `transcribe-audio` | Transcreve áudio de mensagens | No JWT |

### Meta / Templates

| Slug | Descrição | Auth |
|------|-----------|------|
| `meta-oauth` | OAuth com Meta (Facebook/Instagram) | No JWT |
| `meta-sync` | Sincroniza dados do Meta | No JWT |
| `meta-auto-sync` | Sync automático Meta (cron) | No JWT |
| `meta-create-template` | Cria template de mensagem no Meta | No JWT |
| `meta-delete-template` | Deleta template no Meta | No JWT |
| `meta-get-templates` | Lista templates do Meta | No JWT |

### Distribuição de Leads

| Slug | Descrição | Auth |
|------|-----------|------|
| `distribute-lead` | Distribui lead para vendedor disponível | No JWT |
| `auto-assign-conversations` | Atribui conversas em massa por padrão de mensagem | No JWT |

#### `distribute-lead` - Detalhes

**Body:**
```json
{
  "contact_id": "uuid",
  "force_department_id": "uuid (opcional)"
}
```

**Comportamento:**
1. Busca contato e tenant
2. **CHECK 1:** Verifica transferências manuais recentes (60s) - pula se `force_department_id` fornecido
3. **CHECK 2:** Verifica se conversa já tem `assigned_to` - pula se `force_department_id` fornecido
4. Busca config de distribuição em `company_settings`
5. Seleciona agente (sequential/round-robin OU percentage/weighted-random)
6. Atualiza `contacts.assigned_to` e `conversations.assigned_to`
7. Registra em `lead_assignment_history` e `conversation_events`

**IMPORTANTE:** Para forçar redistribuição (ex: transferência de departamento IA → Vendas), passe `force_department_id`. Isso pula os checks de proteção.

**Configuração em `company_settings`:**
- `lead_distribution_enabled` - boolean
- `lead_distribution_type` - 'sequential' | 'percentage'
- `lead_distribution_department_id` - uuid do departamento padrão
- `lead_distribution_position` - posição atual no round-robin
- `lead_distribution_agents` - jsonb array com agents configurados
- `lead_distribution_include_offline` - boolean

### Usuários / Auth

| Slug | Descrição | Auth |
|------|-----------|------|
| `create-user` | Cria novo usuário | No JWT |
| `get-user-details` | Busca detalhes do usuário | No JWT |
| `update-user` | Atualiza dados do usuário | No JWT |
| `delete-user` | Remove usuário | No JWT |
| `reset-user-password` | Reseta senha | No JWT |
| `create-tenant-admin` | Cria admin para tenant | No JWT |
| `register-session` | Registra sessão do usuário | No JWT |

### Flows / Automações

| Slug | Descrição | Auth |
|------|-----------|------|
| `execute-flow-node` | Executa nó de um flow (chatbot) | No JWT |
| `process-flow-triggers` | Processa triggers de flow | No JWT |
| `process-flow-delays` | Processa delays em flows (cron) | No JWT |
| `process-scheduled-messages` | Envia mensagens agendadas (cron) | No JWT |
| `process-rescue-messages` | Processa mensagens de resgate (cron) | No JWT |
| `process-marketing-messages` | Processa campanhas de marketing (cron) | No JWT |
| `test-marketing-campaign` | Testa envio de campanha | No JWT |
| `reprocess-missed-triggers` | Reprocessa triggers perdidos (cron) | No JWT |

### Disparos em Massa

| Slug | Descrição | Auth |
|------|-----------|------|
| `process-bulk-dispatch` | Processa disparos em massa | No JWT |
| `dispatch-webhook` | Webhook para disparos | No JWT |

### Bling (ERP)

| Slug | Descrição | Auth |
|------|-----------|------|
| `bling-oauth` | OAuth com Bling | No JWT |
| `bling-auth` | Autenticação Bling | No JWT |
| `bling-sync` | Sincroniza dados do Bling | JWT |
| `bling-webhook` | Recebe webhooks do Bling | No JWT |
| `bling-token-refresh` | Refresh de token Bling (cron) | No JWT |
| `bling-proxy` | Proxy para API Bling | No JWT |
| `bling-diagnostico` | Diagnóstico de integração Bling | No JWT |
| `sync-bling-vendas` | Sincroniza vendas do Bling (cron 30min) | No JWT |

### Pagamentos

| Slug | Descrição | Auth |
|------|-----------|------|
| `create-rede-payment` | Cria pagamento via Rede | No JWT |
| `rede-webhook` | Webhook da Rede | No JWT |
| `process-rede-payment` | Processa pagamento Rede | No JWT |

### Utilidades

| Slug | Descrição | Auth |
|------|-----------|------|
| `calculate-shipping` | Calcula frete | No JWT |
| `cleanup-webhook-logs` | Limpa logs de webhook (cron) | No JWT |
| `check-expiring-quotes` | Verifica orçamentos expirando (cron) | No JWT |
| `google-sheets-proxy` | Proxy para Google Sheets | No JWT |
| `redirect-capture` | Captura redirects (fingerprint/UTM) | No JWT |
| `find-objection-context` | Busca contexto de objeção para IA | No JWT |
| `process-satisfaction` | Processa pesquisa de satisfação | No JWT |
| `cross-reference-sales` | Cruza dados de vendas CRM x Bling | No JWT |
| `resend-initial-messages` | Reenvia mensagens iniciais | No JWT |
| `migrate-duplicate-conversations` | Migra conversas duplicadas | No JWT |
| `dedupe-redirect-contacts` | Deduplica contatos de redirect | JWT |
| `reconfigure-all-webhooks` | Reconfigura todos os webhooks | No JWT |
| `storage-cleanup` | Limpeza de storage (cron) | JWT |

---

## SQL Functions (RPC)

Chamadas via `supabase.rpc('function_name', { params })`.

### Transferência e Atribuição

| Função | Params | Retorno | Descrição |
|--------|--------|---------|-----------|
| `transfer_conversation` | `p_conversation_id, p_to_user_id?, p_to_department_id?, p_note?, p_force?` | json | Transfere conversa. Se `p_to_user_id` = null, status vira 'pending'. Requer auth (admin/supervisor ou `can_transfer_freely`). |
| `update_conversation_assignment` | `p_conversation_id, p_assigned_to?, p_department_id?, p_status?, p_is_new_transfer?, p_note?` | json | Atualiza atribuição sem checks de permissão (service role). |
| `can_transfer_freely` | `_user_id` | boolean | Verifica se user pode transferir: admin/supervisor → true, `profiles.can_transfer_freely` → valor, `departments.can_transfer_freely` → valor. |

### Acesso e Permissões

| Função | Params | Retorno | Descrição |
|--------|--------|---------|-----------|
| `can_access_conversation` | `conv_id, user_id` | boolean | Verifica se user pode acessar conversa |
| `can_access_conversation_fast` | `_conversation_id, _user_id` | boolean | Versão otimizada |
| `can_access_contact` | `_contact_id, _user_id` | boolean | Verifica acesso a contato |
| `can_view_all_data` | `_user_id` | boolean | Se pode ver todos os dados |
| `can_create_conversation_for_contact` | `p_contact_id, p_user_id` | boolean | Se pode criar conversa |
| `check_user_permission` | `_user_id, _permission` | boolean | Verifica permissão específica |
| `is_admin` | `_user_id` | boolean | É admin? |
| `is_admin_or_supervisor` | `_user_id?` | boolean | É admin ou supervisor? |
| `is_super_admin` | `_user_id?` | boolean | É super admin? |
| `is_master` | `_user_id` | boolean | É master? |
| `is_tenant_owner` | `_user_id?` | boolean | É dono do tenant? |
| `user_has_department` | `_user_id, _department_id` | boolean | User pertence ao departamento? |
| `get_user_department_ids` | `_user_id` | uuid[] | IDs dos departamentos do user |
| `get_user_accessible_departments` | `_user_id` | uuid[] | Departamentos acessíveis |

### Mensagens e Contatos

| Função | Params | Retorno | Descrição |
|--------|--------|---------|-----------|
| `process_incoming_message` | `p_phone, p_channel_id, p_channel_department_id, p_contact_name, p_message_content, p_message_type, ...` | jsonb | Processa mensagem recebida: find/create contact, find/create conversation, insert message |
| `find_contact_by_phone_suffix` | `phone_suffix` | TABLE | Busca contato por sufixo de telefone |
| `search_contacts_paginated` | `p_search_query?, p_state_filter?, p_status_filter?, p_assigned_to?, p_department_id?, p_offset?, p_limit?` | TABLE | Busca paginada de contatos |
| `search_contacts_unaccent` | `p_search_query, p_limit?` | TABLE | Busca sem acentos |
| `search_messages_global` | `p_search_term, p_limit?` | TABLE | Busca global em mensagens |
| `merge_duplicate_contacts` | `p_keep_contact_id, p_duplicate_contact_id, p_use_duplicate_name?` | void | Merge de contatos duplicados |
| `delete_contact_permanently` | `p_contact_id` | void | Deleta contato e todos os dados |

### Dashboard e Métricas

| Função | Params | Retorno | Descrição |
|--------|--------|---------|-----------|
| `get_all_conversation_counts` | `p_user_id, p_department_id?, p_agent_id?, p_channel_id?, p_origin?, p_date_filter?, p_status_filter?, p_timezone?` | jsonb | Contadores de conversas (sidebar) |
| `get_department_counts` | `p_agent_id?, p_channel_id?, p_origin?, p_date_filter?, p_timezone?` | jsonb | Contadores por departamento |
| `get_agent_counts` | `p_department_id?, p_channel_id?, p_origin?, p_date_filter?, p_timezone?` | jsonb | Contadores por agente |
| `get_channel_counts` | `p_department_id?, p_agent_id?, p_origin?, p_date_filter?, p_timezone?` | jsonb | Contadores por canal |
| `get_origin_counts` | `p_department_id?, p_agent_id?, p_channel_id?, p_date_filter?, p_timezone?` | jsonb | Contadores por origem |
| `get_lead_status_counts` | `p_department_id?, p_agent_id?, p_channel_id?, p_origin?, p_status_filter?` | jsonb | Contadores por lead status |
| `get_date_filter_counts` | `p_timezone?, p_department_id?, p_agent_id?, p_channel_id?, p_origin?` | jsonb | Contadores por filtro de data |
| `get_dashboard_metrics_aggregated` | `p_date_from, p_date_to, p_agent_id?, p_department_id?` | jsonb | Métricas consolidadas do dashboard |
| `get_lead_journey_metrics` | `p_date_from, p_date_to, p_agent_id?, p_department_id?, p_channel_id?, p_origin?` | TABLE | Métricas da jornada do lead |
| `get_returning_leads_metrics` | `p_date_from, p_date_to, p_agent_id?, p_department_id?, p_channel_id?, p_origin?` | TABLE | Métricas de leads retornantes |
| `get_conversion_timeline` | `p_date_from, p_date_to, p_agent_id?, p_department_id?, p_conversion_status_names?` | TABLE | Timeline de conversões |
| `get_leads_by_origin` | `p_date_from, p_date_to, p_agent_id?, p_department_id?, p_conversion_status_names?` | TABLE | Leads por origem |
| `get_agent_distribution_advanced` | `p_date_from, p_date_to, p_department_id?, p_conversion_status_names?` | TABLE | Distribuição avançada por agente |
| `get_agents_response_status` | (nenhum) | TABLE | Status de resposta dos agentes (tempo real) |
| `get_agents_response_history` | `p_days?` | TABLE | Histórico de resposta dos agentes |
| `get_agent_waiting_conversations` | `p_agent_id` | TABLE | Conversas aguardando resposta do agente |
| `get_interaction_timeline` | `p_date_from, p_date_to, p_agent_id?, p_department_id?` | TABLE | Timeline de interações por hora |
| `get_status_funnel_realtime` | `p_agent_id?, p_department_id?` | TABLE | Funil de status (tempo real) |
| `get_status_funnel_historical` | `p_date_from, p_date_to, p_agent_id?, p_department_id?, p_origin?` | TABLE | Funil de status (histórico) |
| `get_lead_status_summary` | `_user_id?` | TABLE | Resumo de status de leads |
| `get_kanban_contacts_optimized` | `_user_id, _limit_per_status?` | TABLE | Contatos para kanban |
| `get_lead_alerts` | `p_agent_id?, p_department_id?, p_limit?` | TABLE | Alertas de leads |
| `get_transfer_history` | `p_date_from, p_date_to, p_from_user_id?, p_to_user_id?, ...` | TABLE | Histórico de transferências |
| `get_assignment_time_distribution` | `p_date_from, p_date_to, p_agent_id?, p_department_id?, ...` | json | Distribuição de tempo de atribuição |

### Lead Intelligence

| Função | Params | Retorno | Descrição |
|--------|--------|---------|-----------|
| `get_lead_intelligence` | `p_date_from, p_date_to, p_state?, p_segment_id?, p_campaign?` | TABLE | Intelligence por estado/segmento/campanha |
| `get_lead_intelligence_by_state` | `p_date_from, p_date_to` | TABLE | Intelligence por estado |
| `get_lead_intelligence_by_segment` | `p_date_from, p_date_to, p_state?` | TABLE | Intelligence por segmento |

### Disparos em Massa

| Função | Params | Retorno | Descrição |
|--------|--------|---------|-----------|
| `get_bulk_dispatch_preview_contacts` | `p_tenant_id, p_lead_status_names?, p_last_client_message_days_ago?, p_tag_ids?, ...` | TABLE | Preview de contatos para disparo |
| `get_bulk_dispatch_preview_count` | `p_tenant_id, ...` (mesmos filtros) | bigint | Contagem para preview |

### Tenant / Multi-tenant

| Função | Params | Retorno | Descrição |
|--------|--------|---------|-----------|
| `current_tenant_id` / `get_current_tenant_id` / `get_user_tenant_id` | (nenhum) | uuid | ID do tenant do usuário logado |
| `can_manage_tenant` | `_tenant_id, _user_id?` | boolean | Pode gerenciar tenant? |
| `check_user_tenant_status` | `p_user_id` | TABLE | Status do tenant do user |
| `diagnose_user_tenant` | `p_user_id?` | TABLE | Diagnóstico completo |
| `get_all_tenants_with_stats` | (nenhum) | TABLE | Todos os tenants (super admin) |
| `get_tenant_modules` | `p_tenant_id` | TABLE | Módulos do tenant |
| `update_tenant_modules` | `p_tenant_id, p_modules[]` | void | Atualiza módulos |
| `is_module_enabled` | `p_module_key` | boolean | Módulo habilitado? |
| `sync_menu_items_to_tenant` | `p_target_tenant_id, p_source_tenant_id?` | TABLE | Sincroniza menu |
| `sync_menu_to_all_tenants` | `p_source_tenant_id` | TABLE | Sync menu para todos |

### Relatórios

| Função | Params | Retorno | Descrição |
|--------|--------|---------|-----------|
| `search_conversations_report` | `p_start_date?, p_end_date?, p_name?, p_phone?, p_lead_status[]?, p_channel_ids[]?, p_agent_ids[]?, p_department_ids[]?, p_tag_ids[]?, p_conversation_status[]?, p_page?, p_page_size?` | TABLE | Relatório de conversas paginado |
| `get_conversation_tag_counts` | `p_department_id?, p_agent_id?, p_channel_id?, p_origin?` | json | Contagem por tags |
| `get_conversations_by_tags` | `p_tag_ids[], p_exclude_no_tags?, ...` | TABLE | Conversas filtradas por tags |

### Gamificação

| Função | Params | Retorno | Descrição |
|--------|--------|---------|-----------|
| `gamification_check_badges` | `p_user_id` | void | Verifica badges do user |

### Chat Interno

| Função | Params | Retorno | Descrição |
|--------|--------|---------|-----------|
| `get_internal_chat_threads` | `p_user_id` | TABLE | Threads de chat interno |
| `find_or_create_direct_thread` | `p_user_id, p_other_user_id` | uuid | Encontra ou cria thread direta |
| `get_internal_chat_unread_count` | `p_user_id` | integer | Contagem de não lidos |
| `get_internal_email_unread_count` | `p_user_id` | integer | Emails não lidos |

### Suporte (Tickets)

| Função | Params | Retorno | Descrição |
|--------|--------|---------|-----------|
| `get_support_dashboard_metrics` | `p_date_from?, p_date_to?` | json | Métricas do suporte |
| `get_technician_ranking` | `p_date_from?, p_date_to?` | TABLE | Ranking de técnicos |
| `get_tickets_by_tenant` | (nenhum) | TABLE | Tickets por tenant |
| `get_tickets_evolution` | `p_months?` | TABLE | Evolução de tickets |

### Utilitários

| Função | Params | Retorno | Descrição |
|--------|--------|---------|-----------|
| `accept_invitation` | `invitation_token, user_id` | jsonb | Aceita convite |
| `increment_unread` | `conv_id` | void | Incrementa não lidos |
| `detect_origin_by_message_pattern` | `p_message` | TABLE | Detecta origem pela mensagem |
| `generate_order_number` | `p_tenant_id` | text | Gera número de pedido |
| `generate_quote_number` | `p_tenant_id` | text | Gera número de orçamento |
| `get_public_payment_link` | `link_id` | TABLE | Dados do link de pagamento (público) |

---

## Database Schema

### `conversations`

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| `id` | uuid | NO | gen_random_uuid() | PK |
| `contact_id` | uuid | NO | | FK → contacts |
| `channel_id` | uuid | YES | | FK → channels |
| `assigned_to` | uuid | YES | | FK → profiles (Atendente Atual) |
| `department_id` | uuid | YES | | FK → departments |
| `status` | text | YES | 'open' | open, pending, closed |
| `lead_status` | text | YES | 'new' | Status do lead na conversa |
| `is_unread` | boolean | YES | true | |
| `unread_count` | integer | YES | 0 | |
| `last_message_at` | timestamptz | YES | | |
| `last_message_preview` | text | YES | | |
| `last_message_is_from_me` | boolean | YES | | |
| `last_client_message_at` | timestamptz | YES | | |
| `closed_at` | timestamptz | YES | | |
| `closed_by` | uuid | YES | | |
| `close_reason` | text | YES | | |
| `first_response_at` | timestamptz | YES | | |
| `sla_status` | text | YES | 'ok' | |
| `priority` | text | YES | 'medium' | |
| `transferred_from` | uuid | YES | | Quem transferiu |
| `transferred_at` | timestamptz | YES | | |
| `transfer_note` | text | YES | | |
| `is_new_transfer` | boolean | YES | false | Flag para notificação |
| `referral_data` | jsonb | YES | | Dados de referral |
| `referral_source` | text | YES | | |
| `origin_detection_method` | text | YES | | Como a origem foi detectada |
| `reopened_at` | timestamptz | YES | | |
| `reopen_count` | integer | YES | 0 | |
| `total_active_time_seconds` | integer | YES | 0 | |
| `status_ia` | text | YES | | Status da IA |
| `analysis_status` | text | YES | | |
| `tenant_id` | uuid | NO | | FK → tenants |
| `created_at` | timestamptz | NO | now() | |
| `updated_at` | timestamptz | NO | now() | |

### `contacts`

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| `id` | uuid | NO | gen_random_uuid() | PK |
| `full_name` | text | NO | | |
| `phone` | text | NO | | Telefone (unique por tenant) |
| `email` | text | YES | | |
| `avatar_url` | text | YES | | |
| `cpf_cnpj` | text | YES | | |
| `birth_date` | date | YES | | |
| `person_type` | text | YES | 'individual' | |
| `zip_code` | text | YES | | |
| `street` | text | YES | | |
| `number` | text | YES | | |
| `complement` | text | YES | | |
| `neighborhood` | text | YES | | |
| `city` | text | YES | | |
| `state` | text | YES | | |
| `country` | text | YES | 'Brasil' | |
| `lead_status` | text | YES | 'new' | |
| `assigned_to` | uuid | YES | | FK → profiles (Atendente Responsável / Dono) |
| `department_id` | uuid | YES | | FK → departments |
| `origin` | text | YES | | Origem do contato |
| `origin_campaign` | text | YES | | Campanha de origem |
| `notes` | text | YES | | |
| `custom_fields` | jsonb | YES | '{}' | |
| `is_online` | boolean | YES | false | |
| `is_blocked` | boolean | YES | false | |
| `blocked_reason` | text | YES | | |
| `is_typing` | boolean | YES | false | |
| `lead_score` | integer | YES | 0 | |
| `negotiated_value` | numeric | YES | 0 | |
| `contact_type` | text | YES | 'customer' | |
| `segment_id` | uuid | YES | | |
| `referral_data` | jsonb | YES | | |
| `shirt_quantity` | integer | YES | 0 | |
| `call_permission_status` | text | YES | | |
| `tenant_id` | uuid | NO | | FK → tenants |
| `created_at` | timestamptz | NO | now() | |
| `updated_at` | timestamptz | NO | now() | |

### `messages`

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| `id` | uuid | NO | gen_random_uuid() | PK |
| `conversation_id` | uuid | NO | | FK → conversations |
| `sender_id` | uuid | YES | | FK → profiles (se enviada por agente) |
| `contact_id` | uuid | YES | | FK → contacts (se enviada por contato) |
| `content` | text | YES | | Conteúdo da mensagem |
| `message_type` | text | YES | 'text' | text, image, audio, video, document, sticker, location, contacts, template, interactive, reaction |
| `media_url` | text | YES | | URL da mídia |
| `media_mime_type` | text | YES | | |
| `is_from_me` | boolean | YES | false | Se enviada pelo CRM |
| `status` | text | YES | 'sent' | sent, delivered, read, failed |
| `whatsapp_message_id` | text | YES | | ID da msg no WhatsApp |
| `reply_to_message_id` | uuid | YES | | FK → messages |
| `reactions` | jsonb | YES | '[]' | |
| `is_deleted` | boolean | YES | false | |
| `transcription` | text | YES | | Transcrição de áudio |
| `transcription_status` | text | YES | | pending, completed, failed |
| `trigger_processed` | boolean | YES | false | Se trigger de flow já processou |
| `tenant_id` | uuid | NO | | FK → tenants |
| `created_at` | timestamptz | NO | now() | |

### `profiles`

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| `id` | uuid | NO | | PK (= auth.users.id) |
| `full_name` | text | YES | | |
| `avatar_url` | text | YES | | |
| `email` | text | YES | | |
| `phone` | text | YES | | |
| `role` | text | YES | 'vendedor' | admin, supervisor, vendedor, suporte |
| `department_id` | uuid | YES | | Departamento primário (legacy) |
| `is_active` | boolean | YES | true | |
| `is_available` | boolean | YES | true | |
| `is_online` | boolean | YES | false | |
| `last_seen_at` | timestamptz | YES | | |
| `current_conversations` | integer | YES | 0 | |
| `max_conversations` | integer | YES | 15 | |
| `can_view_all_conversations` | boolean | YES | false | |
| `can_transfer_freely` | boolean | YES | false | |
| `signature_name` | text | YES | | Nome para assinatura *Nome*: |
| `signature_enabled` | boolean | YES | true | |
| `permissions` | jsonb | YES | '{}' | |
| `unavailable_until` | timestamptz | YES | | |
| `unavailability_reason` | text | YES | | |
| `availability_locked_by` | uuid | YES | | |
| `commission_percent` | numeric | YES | 0 | |
| `sales_target_1/2/3` | numeric | YES | 0 | Metas de vendas |
| `bonus_target_1/2/3` | numeric | YES | 0 | Metas de bônus |
| `preferences` | jsonb | YES | '{}' | |
| `tenant_id` | uuid | YES | | FK → tenants |
| `created_at` | timestamptz | NO | now() | |
| `updated_at` | timestamptz | NO | now() | |

### `departments`

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| `id` | uuid | NO | gen_random_uuid() | PK |
| `name` | text | NO | | |
| `description` | text | YES | | |
| `color` | text | YES | '#8B5CF6' | |
| `icon` | text | YES | 'Building' | |
| `is_active` | boolean | YES | true | |
| `can_view_all_conversations` | boolean | YES | false | Membros veem todas as conversas? |
| `can_transfer_freely` | boolean | YES | false | Membros podem transferir? |
| `tenant_id` | uuid | NO | | FK → tenants |
| `created_at` | timestamptz | NO | now() | |

### `user_departments`

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| `id` | uuid | NO | gen_random_uuid() | PK |
| `user_id` | uuid | NO | | FK → profiles |
| `department_id` | uuid | NO | | FK → departments |
| `is_primary` | boolean | YES | false | |
| `tenant_id` | uuid | NO | | FK → tenants |
| `created_at` | timestamptz | YES | now() | |

### `conversation_events`

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| `id` | uuid | NO | gen_random_uuid() | PK |
| `conversation_id` | uuid | NO | | FK → conversations |
| `event_type` | text | NO | | transfer, assignment_change, status_change, etc |
| `actor_id` | uuid | YES | | Quem fez a ação (null = sistema) |
| `data` | jsonb | YES | '{}' | Dados do evento |
| `tenant_id` | uuid | YES | | FK → tenants |
| `created_at` | timestamptz | YES | now() | |

### `lead_assignment_history`

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| `id` | uuid | NO | gen_random_uuid() | PK |
| `contact_id` | uuid | NO | | FK → contacts |
| `conversation_id` | uuid | YES | | FK → conversations |
| `assigned_from` | uuid | YES | | De quem |
| `assigned_to` | uuid | YES | | Para quem |
| `assigned_by` | uuid | YES | | Quem fez |
| `assigned_at` | timestamptz | NO | now() | |
| `assignment_type` | text | YES | 'manual' | manual, auto_distribution, auto_distribution_offline |
| `time_to_assign_seconds` | integer | YES | | |
| `tenant_id` | uuid | YES | | FK → tenants |

### `company_settings`

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| `id` | uuid | NO | gen_random_uuid() | PK |
| `company_name` | text | YES | 'Space Sports' | |
| `cnpj` | text | YES | | |
| `phone` | text | YES | | |
| `email` | text | YES | | |
| `website` | text | YES | | |
| `logo_url` | text | YES | | |
| `address/city/state/zip_code` | text | YES | | |
| `business_hours` | jsonb | YES | {dias da semana} | |
| `timezone` | text | YES | 'America/Sao_Paulo' | |
| `sla_first_response_minutes` | integer | YES | 5 | |
| `sla_resolution_minutes` | integer | YES | 60 | |
| `max_conversations_per_agent` | integer | YES | 15 | |
| `owner_agent_enabled` | boolean | YES | true | Atendente responsável ativo? |
| `owner_agent_inactivity_days` | integer | YES | 7 | Dias para desativar |
| `owner_agent_on_reopen` | boolean | YES | true | Reatribuir ao dono ao reabrir? |
| `owner_agent_reopen_reasons` | text[] | YES | {sold,no_interest,future_contact} | |
| `conversion_status_ids` | uuid[] | YES | | IDs de status de conversão |
| `response_alert_minutes` | integer | YES | 5 | |
| `lead_distribution_enabled` | boolean | YES | false | |
| `lead_distribution_type` | text | YES | 'sequential' | sequential, percentage |
| `lead_distribution_department_id` | uuid | YES | | |
| `lead_distribution_position` | integer | YES | 0 | |
| `lead_distribution_agents` | jsonb | YES | '[]' | |
| `lead_distribution_include_offline` | boolean | YES | false | |
| `payment_gateway_config` | jsonb | YES | '{}' | |
| `shipping_config` | jsonb | YES | | |
| `gamification_source` | text | YES | 'crm' | |
| `tenant_id` | uuid | NO | | FK → tenants |

### `token_bling`

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| `id` | integer | NO | 1 | PK (sempre id=1) |
| `token` | text | NO | | Access token Bling |
| `refresh_token` | text | NO | | Refresh token Bling |
| `basic_auth` | text | NO | | Basic auth Bling |
| `updated_at` | timestamptz | YES | now() | |

---

## Fluxos Importantes

### Fluxo de Mensagem Recebida
1. **Webhook** (`whatsapp-webhook` ou `cloudapi-webhook`) recebe a mensagem
2. Chama `process_incoming_message` (SQL) → find/create contact → find/create conversation → insert message
3. **Triggers automáticos:**
   - `update_first_response_at` - marca primeiro response
   - `update_last_client_message_at` - atualiza último msg do cliente
   - `update_last_message_is_from_me` - flag de direção
   - `mark_audio_for_transcription` - marca áudios para transcrição
   - `sync_conversation_to_contact` - sincroniza status
   - `track_lead_status_change` - registra mudança de status
   - `cancel_rescue_on_lead_response` - cancela resgate se cliente respondeu
4. **Flow triggers** (`process-flow-triggers`) - verifica se há automação para disparar

### Fluxo de Transferência (Manual)
1. Frontend chama `transfer_conversation` (RPC)
2. Verifica permissão (`can_transfer_freely`)
3. Atualiza `conversations` (assigned_to, department_id, status)
4. Registra evento em `conversation_events`

### Fluxo de Distribuição Automática
1. Novo lead chega → `distribute-lead` é chamado
2. Verifica proteções (transfer recente, already assigned)
3. Busca config em `company_settings`
4. Seleciona agente (round-robin ou weighted-random)
5. Atualiza `contacts.assigned_to` + `conversations.assigned_to`
6. Registra em `lead_assignment_history` + `conversation_events`

### Fluxo de Transferência IA → Vendas (n8n)
1. Conversa no departamento "VENDAS IA" (atribuída a agente IA)
2. n8n detecta que deve transferir para "Vendas"
3. Chama `distribute-lead` com `force_department_id` = ID do dept Vendas
4. `force_department_id` pula os checks de proteção
5. Lead é redistribuído para vendedor disponível no departamento Vendas

### Conceito: Atendente Atual vs Atendente Responsável
- **Atendente Atual** = `conversations.assigned_to` - quem está atendendo agora
- **Atendente Responsável (Dono)** = `contacts.assigned_to` - dono fixo do lead
- São campos **independentes** (não sincronizam mais automaticamente)
- `owner_agent_on_reopen` em `company_settings` controla se ao reabrir, reatribui ao dono

### Departamentos do Tenant Base (referência)

| ID | Nome | can_transfer_freely |
|----|------|---------------------|
| `9614a71c-c7b9-45e2-9a32-84423f9b53b1` | VENDAS IA | false |
| `440b4be6-5833-44ae-a1a9-c61162fc0afa` | Vendas | false |
| `f0041e06-960d-45c7-874a-ebb6e2c1cead` | Pós-vendas | true |
| `957b6c4d-5531-4f6b-b8dd-c10eee8521e6` | Expedição | true |
| `ca69a66c-5bd8-490e-aaaf-23333d51b548` | Sala de espera IA | false |
| `470bb4f6-8c44-401e-87f8-6f8a8af7275c` | PEDIDOS IA | false |
| `0b8e09fb-a1db-4227-9088-6d7b198bfe45` | POS-VENDA IA | false |
| `df08e310-6218-4216-ac60-8dacbfd36db2` | Financeiro | false |
| `8db9d7b1-621c-4719-a965-b9e2d4772c20` | Designer | false |
| `0acd0398-1ceb-4b0e-8f49-adc6316de70a` | Suporte | false |
| `0a3b61d8-acb2-4a79-9bd7-6302de23dd86` | FRETE GRATIS | false |
| `0245ad07-93bb-4094-ad97-017ae2f4e978` | AG. PGTO - RESGATE | false |
