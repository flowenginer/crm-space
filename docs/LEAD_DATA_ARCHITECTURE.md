# Arquitetura de Dados — Jornada do Lead no Supabase

> **Propósito**: Este documento mapeia toda a arquitetura de dados da jornada do lead no CRM, desde a captura via anúncio Meta até a conversão. Destinado à análise por AI (Claude) para sugestão de otimizações em campanhas Meta, lead scoring, e implementação de inteligência artificial nos processos de vendas.
>
> **Projeto**: CRMSpace — Supabase Project ID: `lkxrmjqrzhaivviuuamp`

---

## Sumário

1. [Visão Geral da Jornada](#visão-geral-da-jornada)
2. [Tabela de Referência Rápida](#tabela-de-referência-rápida)
3. [Tabela `contacts` — Entidade Central](#tabela-contacts--entidade-central-41-campos)
4. [Tabela `conversations` — Atendimento](#tabela-conversations--atendimento-38-campos)
5. [Tabela `messages` — Comunicação](#tabela-messages--comunicação-20-campos)
6. [Rastreamento Histórico de Eventos](#rastreamento-histórico-de-eventos)
7. [Captura via Redirect (Links Rastreados)](#captura-via-redirect-links-rastreados)
8. [Meta Ads — Hierarquia Completa](#meta-ads--hierarquia-completa)
9. [Como Cruzar Meta Ads com Leads](#como-cruzar-meta-ads-com-leads--ponto-crítico)
10. [Distribuição de Leads](#distribuição-de-leads)
11. [Automações e Fluxos de Chatbot](#automações-e-fluxos-de-chatbot)
12. [Métricas Agregadas e CRM Pipeline](#métricas-agregadas-e-crm-pipeline)
13. [Oportunidades de AI Identificadas](#oportunidades-de-ai-identificadas)
14. [Estruturas JSONB Documentadas](#estruturas-jsonb-documentadas)
15. [Queries SQL de Referência](#queries-sql-de-referência)

---

## Visão Geral da Jornada

```text
╔══════════════════════════════════════════════════════════════════════╗
║                    FONTES DE ENTRADA DO LEAD                         ║
╠══════════════╦═══════════════════╦══════════════╦════════════════════╣
║  Meta Ads    ║  Links Rastreados ║  WhatsApp    ║  Manual / Import   ║
║  (CTWA)      ║  (Redirect UTM)   ║  Orgânico    ║  (Planilha)        ║
╚══════╤═══════╩═════════╤═════════╩══════╤═══════╩════════════════════╝
       │                 │                │
       ▼                 ▼                ▼
┌──────────────────┐  ┌──────────────┐  ┌──────────────────┐
│ cloudapi-webhook │  │redirect-     │  │ whatsapp-webhook │
│ (Meta Cloud API) │  │capture edge  │  │ (Z-API/UAZAPI/   │
│                  │  │function      │  │  Evolution API)  │
└────────┬─────────┘  └──────┬───────┘  └────────┬─────────┘
         │                   │                    │
         └───────────────────┴────────────────────┘
                             │
                             ▼
              ┌──────────────────────────────┐
              │    contacts (entidade central)│
              │  origin, referral_data,       │
              │  lead_status, assigned_to     │
              └──────────────┬───────────────┘
                             │
          ┌──────────────────┼──────────────────┐
          ▼                  ▼                   ▼
  ┌──────────────┐  ┌─────────────────┐  ┌──────────────────┐
  │conversations │  │lead_status_     │  │lead_assignment_  │
  │(atendimento) │  │history          │  │history           │
  └──────┬───────┘  │(rastreio status)│  │(rastreio agente) │
         │          └─────────────────┘  └──────────────────┘
         │
    ┌────┴──────┐
    ▼           ▼
┌────────┐  ┌──────────────────┐
│messages│  │conversation_     │
│(textos,│  │events            │
│ mídia, │  │(transfer, close, │
│ áudio) │  │ assign, reopen)  │
└────────┘  └──────────────────┘
         │
    ┌────┴──────┐
    ▼           ▼
┌────────┐  ┌──────────────────┐
│ deals  │  │daily_metrics +   │
│(CRM    │  │gamification_     │
│pipeline│  │events            │
└────────┘  └──────────────────┘
```

### Providers de WhatsApp Suportados

| Provider | Tabela de Config | Webhook Edge Function |
|----------|------------------|-----------------------|
| Meta Cloud API (oficial) | `cloudapi_configs` | `cloudapi-webhook` |
| Z-API | `zapi_configs` | `whatsapp-webhook` |
| UAZAPI | `uazapi_configs` | `whatsapp-webhook` |
| Evolution API | `evolution_configs` | `whatsapp-webhook` |

---

## Tabela de Referência Rápida

| Tabela | Propósito | Campos Chave para AI |
|--------|-----------|----------------------|
| `contacts` | Entidade central do lead | `origin`, `referral_data`, `lead_status`, `lead_score` |
| `conversations` | Sessão de atendimento | `referral_source`, `referral_data`, `sla_status`, `status_ia` |
| `messages` | Mensagens individuais | `transcription`, `message_type`, `is_from_me`, `content` |
| `lead_status_history` | Histórico de status | `duration_seconds`, `previous_status`, `new_status` |
| `lead_assignment_history` | Histórico de agentes | `time_to_assign_seconds`, `assignment_type` |
| `conversation_events` | Eventos de conversa | `event_type`, `data` (JSONB) |
| `redirect_campaigns` | Links rastreados | `utm_*`, `total_leads`, `total_clicks` |
| `redirect_logs` | Log de cliques | `utm_*`, `converted`, `user_agent` |
| `meta_ad_accounts` | Contas Meta Ads | `account_id`, `currency`, `access_token` |
| `meta_campaigns` | Campanhas | `campaign_id`, `objective`, `status`, `daily_budget` |
| `meta_adsets` | Conjuntos de anúncios | `adset_id`, `targeting` (JSONB) |
| `meta_ads` | Anúncios individuais | `ad_id`, `thumbnail_url`, `preview_url` |
| `meta_campaign_insights` | Métricas diárias | `spend`, `ctr`, `cpc`, `conversions`, `actions` (JSONB) |
| `company_settings` | Config distribuição | `lead_distribution_agents`, `conversion_status_ids` |
| `chatbot_flows` | Fluxos de automação | `total_executions`, `total_completions` |
| `flow_executions` | Execuções por lead | `variables` (JSONB), `status` |
| `daily_metrics` | Métricas agregadas | `avg_first_response_seconds`, `deals_won`, `revenue` |
| `deals` | Pipeline CRM | `value`, `status`, `days_in_stage` |
| `gamification_profiles` | Performance vendedor | `points`, `level`, `ranking` |

---

## Tabela `contacts` — Entidade Central (41 campos)

> **Como encontrar**: `SELECT * FROM contacts WHERE tenant_id = '<tenant_id>' LIMIT 10;`
> 
> **Contexto**: Todo lead que entra no sistema gera ou atualiza um registro em `contacts`. É a entidade central de onde tudo se origina.

### Identificação do Lead

| Campo | Tipo | Obrigatório | Origem | Descrição |
|-------|------|-------------|--------|-----------|
| `id` | uuid | ✅ | Automático | Chave primária gerada pelo Supabase |
| `full_name` | text | ✅ | WhatsApp profile / Manual | Nome do contato |
| `phone` | text | ✅ | WhatsApp / Importação | Telefone normalizado: `55` + DDD + número. Ex: `5511987654321` |
| `email` | text | ❌ | Manual / Importação | E-mail do contato |
| `cpf_cnpj` | text | ❌ | Manual / Importação | Documento fiscal |
| `birth_date` | date | ❌ | Manual | Data de nascimento |
| `person_type` | text | ❌ | Default: `individual` | `individual` \| `company` |
| `contact_type` | text | ❌ | Default: `customer` | Tipo no CRM |
| `avatar_url` | text | ❌ | WhatsApp profile | Foto de perfil |
| `notes` | text | ❌ | Manual | Observações livres sobre o lead |
| `tenant_id` | uuid | ✅ | Sistema | Multi-tenancy: empresa dona do lead |

### Localização

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `zip_code` | text | CEP |
| `street` | text | Logradouro |
| `number` | text | Número |
| `complement` | text | Complemento |
| `neighborhood` | text | Bairro |
| `city` | text | Cidade |
| `state` | text | Estado (UF) |
| `country` | text | País (default: `Brasil`) |

### Status no CRM

| Campo | Tipo | Valores Possíveis | Descrição |
|-------|------|-------------------|-----------|
| `lead_status` | text | Configurável via `lead_statuses` | Status atual. Ex: `01 - Novo Lead`, `07 - Pedido Fechado` |
| `lead_score` | integer | 0-100+ | Score calculado de qualidade do lead |
| `assigned_to` | uuid → profiles | UUID do agente | Agente responsável atual |
| `department_id` | uuid → departments | UUID do departamento | Departamento atribuído |
| `segment_id` | uuid → segments | UUID do segmento | Segmento de mercado |

> **Nota**: Os valores de `lead_status` são configuráveis pela empresa. Buscar valores reais em: `SELECT name, id FROM lead_statuses WHERE is_active = true ORDER BY order_position;`

### ⭐ Rastreamento de Origem (Campo Crítico para AI)

| Campo | Tipo | Valores | Descrição |
|-------|------|---------|-----------|
| `origin` | text | `meta_ads` \| `redirect` \| `organic` \| `linktree` \| `manual` \| `import` | Canal de entrada do lead |
| `origin_campaign` | text | Nome livre | Nome da campanha. Ex: `Converse conosco` |
| `referral_data` | jsonb | Ver estruturas abaixo | Dados completos do anúncio/UTM de origem |

**`referral_data` — Formato CTWA (Click-to-WhatsApp via Meta Cloud API)**:
```json
{
  "ctwaClid": "AffMS1U1P_rQIhCEDt3...",
  "conversionSource": "FB_Ads",
  "sourceId": "120234951574890118",
  "sourceType": "ad",
  "sourceUrl": "https://fb.me/7oha6oVtY",
  "sourceApp": "facebook",
  "headline": "Converse conosco",
  "adName": "Converse conosco",
  "imageUrl": "https://scontent.xx.fbcdn.net/...",
  "thumbnailUrl": "https://scontent.xx.fbcdn.net/...",
  "videoUrl": "https://www.facebook.com/reel/...",
  "body": "Oi! Como podemos ajudar?",
  "greetingMessageBody": "Oi! Como podemos ajudar?",
  "showAdAttribution": true,
  "ctwaPayload": "base64encodedpayload..."
}
```

**`referral_data` — Formato Redirect (Links Rastreados com UTM)**:
```json
{
  "campaign_id": "bf69fd64-6087-4c9c-941a-f5c8f765f141",
  "campaign_name": "metaAds",
  "utm_source": "meta_ads",
  "utm_medium": "SS02.4 | AGRO | SEGMENTADO",
  "utm_campaign": "meta_ads",
  "utm_content": "SS02.4-1 CT_VIDEO - AGRO",
  "utm_term": "120238981220820118"
}
```

> 🔑 **Chave para cruzamento**: `referral_data->>'sourceId'` (CTWA) ou `referral_data->>'utm_term'` (Redirect) = `meta_ads.ad_id`

### Engajamento e Presença

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `first_contact_at` | timestamptz | Timestamp do primeiro contato |
| `last_interaction_at` | timestamptz | Última interação registrada |
| `last_seen_at` | timestamptz | Última vez online no WhatsApp |
| `is_online` | boolean | Presença em tempo real (via webhook) |
| `is_typing` | boolean | Digitando no momento |

### Negociação e Campos de Negócio

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `negotiated_value` | numeric | Valor negociado em R$ |
| `shirt_quantity` | integer | Campo específico: quantidade de camisas (negócio do cliente) |
| `custom_fields` | jsonb | Campos customizáveis + array `conversoes` (pedidos fechados) |

**`custom_fields` — Estrutura de `conversoes`** (pedidos/vendas fechadas):
```json
{
  "conversoes": [
    {
      "data": "2024-02-15",
      "valor": 1500.00,
      "produto": "Kit Uniforme Corporativo",
      "quantidade": 50,
      "observacao": "Pedido urgente"
    }
  ],
  "campo_customizado_1": "valor",
  "campo_customizado_2": "valor"
}
```

> Campos customizados são definidos em `custom_field_definitions`. Buscar definições: `SELECT * FROM custom_field_definitions WHERE tenant_id = '<tenant_id>';`

### Bloqueio e VoIP

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `is_blocked` | boolean | Lead bloqueado (não recebe mensagens) |
| `blocked_reason` | text | Motivo do bloqueio |
| `call_permission_status` | text | Status da permissão para chamada VoIP |
| `call_permission_requested_at` | timestamptz | Quando a permissão foi solicitada |

---

## Tabela `conversations` — Atendimento (38 campos)

> **Como encontrar**: `SELECT * FROM conversations WHERE contact_id = '<contact_uuid>' ORDER BY created_at DESC;`
>
> **Contexto**: Uma conversa é criada para cada sessão de atendimento. Um mesmo lead pode ter múltiplas conversas ao longo do tempo (histórico completo mantido).

### Relacionamentos

| Campo | Tipo | Referência | Descrição |
|-------|------|-----------|-----------|
| `contact_id` | uuid | → contacts | Lead associado |
| `channel_id` | uuid | → whatsapp_channels | Canal de WhatsApp usado |
| `assigned_to` | uuid | → profiles | Agente responsável pelo atendimento |
| `department_id` | uuid | → departments | Departamento responsável |

### Status e Prioridade

| Campo | Tipo | Valores | Descrição |
|-------|------|---------|-----------|
| `status` | text | `pending` \| `open` \| `closed` | Status da conversa |
| `lead_status` | text | Configurável | Status do lead no momento |
| `priority` | text | `low` \| `medium` \| `high` | Prioridade de atendimento |
| `sla_status` | text | `ok` \| `warning` \| `critical` | Status do SLA em tempo real |

### Métricas de Tempo (SLA)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `created_at` | timestamptz | Quando a conversa foi criada (lead entrou) |
| `first_response_at` | timestamptz | Primeira resposta do agente |
| `last_message_at` | timestamptz | Timestamp da última mensagem (qualquer direção) |
| `last_client_message_at` | timestamptz | Última mensagem do cliente (base para SLA) |
| `total_active_time_seconds` | integer | Tempo total de atendimento ativo em segundos |
| `closed_at` | timestamptz | Quando foi encerrada |

> 📊 **Para calcular tempo de primeira resposta**: `first_response_at - created_at`

### ⭐ Origem do Anúncio (Chave para Cruzamento com Meta Ads)

| Campo | Tipo | Valores | Descrição |
|-------|------|---------|-----------|
| `referral_source` | text | `ctwa_ad` \| `redirect` \| `organic` | Tipo de origem da conversa |
| `referral_data` | jsonb | Mesma estrutura de `contacts.referral_data` | Dados do anúncio que originou esta conversa |

> 🔑 **Chave de cruzamento**: `conversations.referral_data->>'sourceId'` = `meta_ads.ad_id`

### Transferências

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `transferred_from` | uuid → profiles | Agente que realizou a transferência |
| `transferred_at` | timestamptz | Quando foi transferida |
| `transfer_note` | text | Motivo/observação da transferência |
| `is_new_transfer` | boolean | Flag para destacar na fila do agente receptor |

### Encerramento

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `closed_at` | timestamptz | Quando foi encerrada |
| `closed_by` | uuid → profiles | Agente que encerrou |
| `close_reason` | text | Motivo de encerramento |
| `reopen_count` | integer | Quantas vezes foi reaberta |
| `reopened_at` | timestamptz | Última reabertura |
| `previous_close_reason` | text | Motivo do encerramento anterior |

### AI / Análise Automática

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `analysis_status` | text | Status da análise automática da conversa |
| `status_ia` | text | Classificação feita por AI (ex: `interested`, `not_interested`, `negotiating`) |

### Estado das Mensagens

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `last_message_preview` | text | Preview da última mensagem para listagem |
| `last_message_is_from_me` | boolean | Se a última mensagem foi do agente |
| `is_unread` | boolean | Se há mensagens não lidas |
| `unread_count` | integer | Quantidade de mensagens não lidas |

---

## Tabela `messages` — Comunicação (20 campos)

> **Como encontrar**: `SELECT * FROM messages WHERE conversation_id = '<conv_uuid>' ORDER BY created_at ASC;`

| Campo | Tipo | Valores/Descrição |
|-------|------|-------------------|
| `id` | uuid | Chave primária |
| `conversation_id` | uuid → conversations | Conversa à qual pertence |
| `contact_id` | uuid → contacts | Lead (quando mensagem do cliente) |
| `sender_id` | uuid → profiles | Agente (quando mensagem do agente) |
| `content` | text | Texto da mensagem |
| `message_type` | text | `text` \| `image` \| `audio` \| `video` \| `document` \| `sticker` \| `location` \| `contact` \| `reaction` \| `template` |
| `media_url` | text | URL no Supabase Storage (bucket: `conversation-attachments`) |
| `media_mime_type` | text | MIME type original. Ex: `audio/ogg`, `image/jpeg` |
| `is_from_me` | boolean | `true` = agente enviou, `false` = cliente enviou |
| `status` | text | `sent` \| `delivered` \| `read` \| `failed` |
| `whatsapp_message_id` | text | ID original da mensagem na plataforma WhatsApp |
| `reply_to_message_id` | uuid → messages | Para mensagens em resposta a outra |
| `reactions` | jsonb | `{"😀": ["contact_id_1"], "❤️": ["contact_id_2"]}` |
| `is_deleted` | boolean | Se foi deletada |
| `deleted_at` | timestamptz | Quando foi deletada |
| `transcription` | text | ⭐ Transcrição de áudio (via edge function `transcribe-audio`) |
| `transcription_status` | text | `pending` \| `processing` \| `completed` \| `failed` |
| `trigger_processed` | boolean | Se já disparou triggers de automação |
| `created_at` | timestamptz | Quando foi enviada/recebida |

> 🎤 **Oportunidade de AI**: `transcription` contém o texto de todos os áudios trocados. Disponível para análise de sentimento, detecção de objeções e extração de intenção.

---

## Rastreamento Histórico de Eventos

### `lead_status_history` — Toda Mudança de Status

> **Como encontrar**: `SELECT * FROM lead_status_history WHERE contact_id = '<uuid>' ORDER BY changed_at;`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | uuid | Chave primária |
| `contact_id` | uuid → contacts | Lead que teve o status alterado |
| `previous_status` | text | Status anterior |
| `new_status` | text | Novo status |
| `changed_by` | uuid → profiles | Agente que realizou a mudança (null = automático) |
| `changed_at` | timestamptz | Timestamp exato da mudança |
| `duration_seconds` | integer | ⭐ Tempo em segundos que ficou no status anterior |

> 📊 **Para análise de funil**: `duration_seconds` por status e por `contacts.origin` revela onde cada tipo de lead trava na jornada.

### `lead_assignment_history` — Toda Troca de Agente

> **Como encontrar**: `SELECT * FROM lead_assignment_history WHERE contact_id = '<uuid>' ORDER BY assigned_at;`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | uuid | Chave primária |
| `contact_id` | uuid → contacts | Lead |
| `conversation_id` | uuid → conversations | Conversa relacionada |
| `assigned_from` | uuid → profiles | Agente anterior |
| `assigned_to` | uuid → profiles | Agente recebedor |
| `assigned_by` | uuid → profiles | Quem realizou a atribuição |
| `assigned_at` | timestamptz | Timestamp da atribuição |
| `assignment_type` | text | `auto_distribution` \| `manual` \| `transfer` |
| `time_to_assign_seconds` | integer | ⭐ Tempo desde criação do lead até esta atribuição |

### `conversation_events` — Linha do Tempo de Ações

> **Como encontrar**: `SELECT * FROM conversation_events WHERE conversation_id = '<uuid>' ORDER BY created_at;`

| Campo | Tipo | Valores | Descrição |
|-------|------|---------|-----------|
| `id` | uuid | — | Chave primária |
| `conversation_id` | uuid | → conversations | Conversa |
| `event_type` | text | `transfer` \| `close` \| `reopen` \| `assign` \| `channel_changed` \| `priority_changed` | Tipo do evento |
| `actor_id` | uuid → profiles | — | Quem realizou a ação |
| `created_at` | timestamptz | — | Quando ocorreu |
| `data` | jsonb | Ver abaixo | Contexto detalhado do evento |

**`data` JSONB — Estrutura por tipo de evento**:
```json
{
  "from_user": "uuid-agente-origem",
  "to_user": "uuid-agente-destino",
  "is_auto_distribution": true,
  "note": "Observação da transferência",
  "reason": "sold",
  "previous_priority": "low",
  "new_priority": "high"
}
```

---

## Captura via Redirect (Links Rastreados)

> **Contexto**: Sistema de links curtos rastreados que direcionam para WhatsApp com captura de UTMs, pixels e distribuição automática entre canais.

### `redirect_campaigns` — Links de Captura

> **Como encontrar**: `SELECT * FROM redirect_campaigns WHERE tenant_id = '<tenant_id>';`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | uuid | Chave primária |
| `name` | text | Nome da campanha |
| `slug` | text | Slug do link (ex: `agro-01`) → URL: `/r/agro-01` |
| `distribution_mode` | text | `round_robin` \| `percentage` |
| `facebook_pixel_id` | text | ID do Pixel do Facebook para rastreamento |
| `gtm_container_id` | text | Container do Google Tag Manager |
| `google_analytics_id` | text | ID do Google Analytics |
| `department_id` | uuid | Departamento atribuído automaticamente ao capturar |
| `tag_id` | uuid | Tag aplicada automaticamente ao lead capturado |
| `total_clicks` | integer | Total de cliques no link |
| `total_leads` | integer | Total de leads gerados |
| `views_count` | integer | Visualizações da página de redirect |
| `is_active` | boolean | Se a campanha está ativa |

### `redirect_campaign_channels` — WhatsApps Vinculados

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `campaign_id` | uuid → redirect_campaigns | Campanha |
| `channel_id` | uuid → whatsapp_channels | Canal de WhatsApp |
| `percentage` | integer | % de leads para este canal (modo percentual) |
| `position` | integer | Posição no round-robin |
| `is_active` | boolean | Se este canal está ativo na distribuição |

### `redirect_logs` — Cada Clique Registrado

> **Como encontrar**: `SELECT * FROM redirect_logs WHERE campaign_id = '<uuid>' ORDER BY created_at DESC;`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | uuid | Chave primária |
| `campaign_id` | uuid | Campanha |
| `contact_id` | uuid → contacts | Lead gerado (null se não converteu) |
| `channel_id` | uuid | Canal WhatsApp para onde foi direcionado |
| `phone` | text | Telefone capturado |
| `country_code` | text | Código do país |
| `ip_address` | text | IP do visitante |
| `user_agent` | text | Navegador/dispositivo |
| `utm_source` | text | Ex: `meta_ads`, `google` |
| `utm_medium` | text | Ex: `SS02.4 \| AGRO \| SEGMENTADO` |
| `utm_campaign` | text | Ex: `agro-verao-2024` |
| `utm_term` | text | ⭐ ID do anúncio Meta (cruza com `meta_ads.ad_id`) |
| `utm_content` | text | Ex: `SS02.4-1 CT_VIDEO - AGRO` |
| `referrer` | text | URL de origem do clique |
| `converted` | boolean | Se o lead efetivamente abriu o WhatsApp |
| `created_at` | timestamptz | Quando o clique ocorreu |

---

## Meta Ads — Hierarquia Completa

> **Contexto**: Dados sincronizados via OAuth + API do Meta pelas edge functions `meta-sync` (manual) e `meta-auto-sync` (automático por cron). Hierarquia: Conta → Campanha → Conjunto → Anúncio → Insights.

### `meta_ad_accounts` — Contas de Anúncios

> **Como encontrar**: `SELECT account_id, account_name, currency, last_auto_sync_at FROM meta_ad_accounts WHERE tenant_id = '<tenant_id>';`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | uuid | Chave primária interna |
| `account_id` | text | ID da conta no Meta (ex: `act_123456789`) |
| `account_name` | text | Nome da conta |
| `business_id` | text | ID do Business Manager |
| `currency` | text | Moeda (ex: `BRL`) |
| `timezone` | text | Fuso horário da conta |
| `access_token` | text | Token OAuth do usuário (sensível) |
| `auto_sync_enabled` | boolean | Se sincronização automática está ativa |
| `sync_interval_hours` | integer | Intervalo de sync em horas |
| `last_auto_sync_at` | timestamptz | Última sincronização automática |
| `tenant_id` | uuid | Empresa proprietária |

### `meta_campaigns` — Campanhas

> **Como encontrar**: `SELECT campaign_id, name, objective, status, daily_budget FROM meta_campaigns WHERE account_id = '<account_uuid>';`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | uuid | Chave primária interna |
| `campaign_id` | text | ⭐ ID da campanha no Meta — cruza com `contacts.referral_data->>'campaign_id'` |
| `account_id` | uuid → meta_ad_accounts | Conta |
| `name` | text | Nome da campanha |
| `objective` | text | Ex: `MESSAGES`, `CONVERSIONS`, `TRAFFIC` |
| `status` | text | `ACTIVE` \| `PAUSED` \| `DELETED` \| `ARCHIVED` |
| `daily_budget` | numeric | Orçamento diário em centavos |
| `lifetime_budget` | numeric | Orçamento total em centavos |
| `start_time` | timestamptz | Início da campanha |
| `stop_time` | timestamptz | Fim da campanha (null = sem prazo) |

### `meta_adsets` — Conjuntos de Anúncios

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | uuid | Chave primária interna |
| `adset_id` | text | ID do conjunto no Meta |
| `campaign_id` | uuid → meta_campaigns | Campanha pai |
| `name` | text | Nome do conjunto |
| `status` | text | `ACTIVE` \| `PAUSED` \| `DELETED` |
| `daily_budget` | numeric | Orçamento diário |
| `lifetime_budget` | numeric | Orçamento total |
| `targeting` | jsonb | ⭐ Segmentação completa: interesses, localização, idade, gênero, audiências personalizadas |
| `optimization_goal` | text | Ex: `REPLIES`, `LINK_CLICKS` |
| `billing_event` | text | Ex: `IMPRESSIONS` |

**`targeting` JSONB — Estrutura de Segmentação**:
```json
{
  "age_max": 65,
  "age_min": 25,
  "genders": [1, 2],
  "geo_locations": {
    "cities": [...],
    "regions": [...],
    "countries": ["BR"]
  },
  "interests": [
    {"id": "6003139266461", "name": "Agriculture"}
  ],
  "custom_audiences": [
    {"id": "23843...", "name": "Lookalike - Compradores"}
  ],
  "excluded_custom_audiences": [...],
  "flexible_spec": [...]
}
```

### `meta_ads` — Anúncios Individuais

> **Como encontrar**: `SELECT ad_id, name, status, thumbnail_url FROM meta_ads WHERE adset_id = '<adset_uuid>';`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | uuid | Chave primária interna |
| `ad_id` | text | ⭐ ID do anúncio no Meta — **este é o campo de cruzamento com leads** |
| `adset_id` | uuid → meta_adsets | Conjunto pai |
| `campaign_id` | uuid → meta_campaigns | Campanha pai |
| `account_id` | uuid → meta_ad_accounts | Conta |
| `name` | text | Nome do anúncio |
| `status` | text | `ACTIVE` \| `PAUSED` \| `DELETED` |
| `creative_id` | text | ID do criativo no Meta |
| `thumbnail_url` | text | URL da imagem de thumbnail do anúncio |
| `preview_url` | text | URL de preview do anúncio |
| `tenant_id` | uuid | Empresa |

### `meta_campaign_insights` — Métricas Diárias de Performance

> **Como encontrar**: `SELECT * FROM meta_campaign_insights WHERE campaign_id = '<uuid>' ORDER BY date_start DESC LIMIT 30;`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | uuid | Chave primária |
| `campaign_id` | uuid → meta_campaigns | Campanha |
| `adset_id` | uuid → meta_adsets | Conjunto (pode ser null — nível campanha) |
| `ad_id` | uuid → meta_ads | Anúncio (pode ser null — nível campanha) |
| `date_start` | date | Data de início do período |
| `date_stop` | date | Data de fim do período |
| `impressions` | integer | Impressões |
| `clicks` | integer | Cliques totais |
| `reach` | integer | Alcance único |
| `spend` | numeric | ⭐ Valor gasto no período (R$) |
| `ctr` | numeric | Taxa de clique (%) |
| `cpc` | numeric | Custo por clique (R$) |
| `cpm` | numeric | Custo por mil impressões (R$) |
| `conversions` | integer | Conversões registradas pelo Meta |
| `cost_per_conversion` | numeric | Custo por conversão (R$) |
| `frequency` | numeric | Frequência média de exibição |
| `actions` | jsonb | ⭐ Array detalhado de ações da Meta API |
| `tenant_id` | uuid | Empresa |

**`actions` JSONB — Estrutura do Array de Ações**:
```json
[
  {"action_type": "link_click", "value": "342"},
  {"action_type": "onsite_conversion.messaging_conversation_started_7d", "value": "87"},
  {"action_type": "onsite_conversion.messaging_first_reply", "value": "72"},
  {"action_type": "offsite_conversion.fb_pixel_purchase", "value": "12"}
]
```

---

## Como Cruzar Meta Ads com Leads — Ponto Crítico

> Este é o mapeamento fundamental para calcular ROI real de campanhas e atribuir conversões a anúncios específicos.

### Diagrama de Cruzamento

```text
LEAD ENTROU VIA CTWA (Click-to-WhatsApp):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
meta_ads.ad_id
    ↕ IGUAL A
contacts.referral_data->>'sourceId'
conversations.referral_data->>'sourceId'

LEAD ENTROU VIA REDIRECT (Link Rastreado):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
meta_ads.ad_id
    ↕ IGUAL A
contacts.referral_data->>'utm_term'
redirect_logs.utm_term

CAMPANHA:
━━━━━━━━
meta_campaigns.campaign_id
    ↕ IGUAL A
contacts.referral_data->>'campaign_id'    (Redirect)

CONVERSÃO (STATUS CONFIGURÁVEL):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
company_settings.conversion_status_ids   (array de UUIDs dos status de lead)
    ↕ DEFINE
lead_statuses.id                          (ex: UUID do "07 - Pedido Fechado")
    ↕ VERIFICA EM
contacts.lead_status                      (status atual do lead)
lead_status_history                       (histórico — lead já passou por este status)
```

### Queries SQL de Cruzamento

**ROI por Campanha (CTWA)**:
```sql
SELECT 
  ma.name as ad_name,
  mc.name as campaign_name,
  COUNT(DISTINCT c.id) as leads_gerados,
  COUNT(DISTINCT CASE 
    WHEN c.lead_status IN (
      SELECT ls.name FROM lead_statuses ls 
      JOIN company_settings cs ON ls.id = ANY(cs.conversion_status_ids::uuid[])
    ) THEN c.id 
  END) as conversoes,
  SUM(mci.spend) as investimento_total,
  ROUND(
    COUNT(DISTINCT CASE WHEN c.lead_status LIKE '%Fechado%' THEN c.id END)::numeric 
    / NULLIF(COUNT(DISTINCT c.id), 0) * 100, 2
  ) as taxa_conversao_pct
FROM contacts c
JOIN conversations conv ON conv.contact_id = c.id
JOIN meta_ads ma ON ma.ad_id = conv.referral_data->>'sourceId'
JOIN meta_campaigns mc ON mc.id = ma.campaign_id
LEFT JOIN meta_campaign_insights mci ON mci.ad_id = ma.id
WHERE c.origin = 'meta_ads'
  AND conv.referral_source = 'ctwa_ad'
GROUP BY ma.name, mc.name
ORDER BY conversoes DESC;
```

**Leads por Anúncio com Tempo de Conversão**:
```sql
SELECT 
  ma.name as anuncio,
  c.id as contact_id,
  c.full_name,
  c.lead_status,
  c.created_at as entrada,
  MIN(lsh.changed_at) FILTER (WHERE lsh.new_status LIKE '%Fechado%') as conversao_em,
  EXTRACT(EPOCH FROM (
    MIN(lsh.changed_at) FILTER (WHERE lsh.new_status LIKE '%Fechado%') - c.created_at
  ))/3600 as horas_ate_conversao
FROM contacts c
JOIN conversations conv ON conv.contact_id = c.id
JOIN meta_ads ma ON ma.ad_id = conv.referral_data->>'sourceId'
LEFT JOIN lead_status_history lsh ON lsh.contact_id = c.id
WHERE c.origin = 'meta_ads'
GROUP BY ma.name, c.id, c.full_name, c.lead_status, c.created_at
ORDER BY horas_ate_conversao ASC NULLS LAST;
```

---

## Distribuição de Leads

> **Localização**: `SELECT lead_distribution_enabled, lead_distribution_type, lead_distribution_agents FROM company_settings WHERE tenant_id = '<tenant_id>';`
>
> **Contexto**: A distribuição automática de leads é configurada em `company_settings` e executada pela edge function `distribute-lead` (ou `cloudapi-webhook`/`whatsapp-webhook` ao capturar novo lead).

### Configurações em `company_settings`

| Campo | Tipo | Valores | Descrição |
|-------|------|---------|-----------|
| `lead_distribution_enabled` | boolean | — | Liga/desliga distribuição automática |
| `lead_distribution_type` | text | `sequential` \| `percentage` | Algoritmo de distribuição |
| `lead_distribution_department_id` | uuid → departments | — | Departamento para distribuição |
| `lead_distribution_position` | integer | — | Posição atual no round-robin (sequential) |
| `lead_distribution_include_offline` | boolean | — | Se distribui para agentes offline |
| `lead_distribution_agents` | jsonb | Array | Lista de agentes com configurações |
| `conversion_status_ids` | uuid[] | Array de UUIDs | ⭐ Status que definem "conversão" — campo dinâmico |

**`lead_distribution_agents` JSONB — Array de Agentes**:
```json
[
  {
    "user_id": "uuid-agente-1",
    "percentage": 40,
    "leads_received": 127,
    "is_active": true,
    "position": 1
  },
  {
    "user_id": "uuid-agente-2", 
    "percentage": 40,
    "leads_received": 125,
    "is_active": true,
    "position": 2
  },
  {
    "user_id": "uuid-agente-3",
    "percentage": 20,
    "leads_received": 62,
    "is_active": false,
    "position": 3
  }
]
```

> ⚠️ **Atenção**: `leads_received` é o contador usado para balancear a distribuição. Um agente offline (`is_active: false`) não recebe leads no modo `percentage`. No modo `sequential`, a posição (`lead_distribution_position`) avança independente de status online.

---

## Automações e Fluxos de Chatbot

### `chatbot_flows` — Definição dos Fluxos

> **Como encontrar**: `SELECT id, name, is_active, total_executions, total_completions FROM chatbot_flows WHERE tenant_id = '<tenant_id>';`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | uuid | Chave primária |
| `name` | text | Nome do fluxo |
| `description` | text | Descrição do fluxo |
| `channel_ids` | uuid[] | Canais WhatsApp onde o fluxo atua |
| `priority` | integer | Prioridade de execução (menor = maior prioridade) |
| `is_active` | boolean | Se está ativo |
| `is_draft` | boolean | Se é rascunho (não executa) |
| `run_once_per_contact` | boolean | Se executa apenas uma vez por lead |
| `total_executions` | integer | Total de execuções iniciadas |
| `total_completions` | integer | Total de execuções completadas |
| `total_errors` | integer | Total de erros |

### `flow_executions` — Instâncias por Lead

> **Como encontrar**: `SELECT * FROM flow_executions WHERE contact_id = '<uuid>' ORDER BY created_at DESC;`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | uuid | Chave primária |
| `flow_id` | uuid → chatbot_flows | Fluxo executado |
| `conversation_id` | uuid → conversations | Conversa do lead |
| `contact_id` | uuid → contacts | Lead |
| `channel_id` | uuid → whatsapp_channels | Canal |
| `status` | text | `running` \| `completed` \| `failed` \| `waiting` |
| `current_node_id` | text | Nó atual em execução |
| `variables` | jsonb | ⭐ Respostas capturadas do lead durante o fluxo |
| `waiting_until` | timestamptz | Timestamp do próximo envio (para delays) |
| `started_at` | timestamptz | Início da execução |
| `completed_at` | timestamptz | Fim da execução |

**`variables` JSONB — Respostas Capturadas no Fluxo**:
```json
{
  "nome": "João Silva",
  "quantidade_camisas": "150",
  "cidade": "São Paulo",
  "prazo_entrega": "urgent",
  "tipo_produto": "uniforme_corporativo"
}
```

### `flow_execution_logs` — Log Detalhado por Nó

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `execution_id` | uuid → flow_executions | Execução |
| `node_id` | text | ID do nó no fluxo |
| `log_type` | text | `info` \| `error` \| `debug` |
| `message` | text | Mensagem do log |
| `details` | jsonb | Contexto adicional do erro/evento |
| `created_at` | timestamptz | Quando ocorreu |

---

## Métricas Agregadas e CRM Pipeline

### `daily_metrics` — Por Agente/Departamento/Dia

> **Como encontrar**: `SELECT * FROM daily_metrics WHERE date >= '2024-01-01' AND user_id = '<uuid>' ORDER BY date DESC;`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | uuid | Chave primária |
| `date` | date | Data das métricas |
| `user_id` | uuid → profiles | Agente (null = total do departamento) |
| `department_id` | uuid → departments | Departamento |
| `new_contacts` | integer | Novos leads no dia |
| `conversations_started` | integer | Conversas iniciadas |
| `conversations_closed` | integer | Conversas encerradas |
| `conversations_transferred` | integer | Conversas transferidas |
| `messages_sent` | integer | Mensagens enviadas pelo agente |
| `messages_received` | integer | Mensagens recebidas de leads |
| `avg_first_response_seconds` | numeric | ⭐ Tempo médio de primeira resposta |
| `avg_resolution_seconds` | numeric | Tempo médio de resolução |
| `sla_ok` | integer | Conversas dentro do SLA |
| `sla_warning` | integer | Conversas em alerta de SLA |
| `sla_critical` | integer | Conversas críticas de SLA |
| `deals_created` | integer | Negócios criados no CRM |
| `deals_won` | integer | Negócios ganhos |
| `deals_lost` | integer | Negócios perdidos |
| `revenue` | numeric | Receita do dia (deals ganhos) |
| `tenant_id` | uuid | Empresa |

### `deals` — Pipeline CRM

> **Como encontrar**: `SELECT * FROM deals WHERE contact_id = '<uuid>' ORDER BY created_at DESC;`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | uuid | Chave primária |
| `pipeline_id` | uuid → pipelines | Pipeline de vendas |
| `stage_id` | uuid → pipeline_stages | Estágio atual |
| `contact_id` | uuid → contacts | Lead |
| `assigned_to` | uuid → profiles | Responsável |
| `title` | text | Título do negócio |
| `value` | numeric | Valor em R$ |
| `status` | text | `open` \| `won` \| `lost` |
| `expected_close_date` | date | Previsão de fechamento |
| `closed_at` | timestamptz | Quando foi fechado |
| `lost_reason` | text | Motivo da perda |
| `days_in_stage` | integer | Dias no estágio atual |
| `stage_entered_at` | timestamptz | Quando entrou no estágio |

### `gamification_profiles` — Performance de Vendedores

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `user_id` | uuid → profiles | Vendedor |
| `points` | integer | Pontuação total acumulada |
| `level` | integer | Nível atual |
| `ranking` | integer | Posição no ranking |
| `badges` | jsonb | Conquistas obtidas |
| `period_points` | integer | Pontos do período atual |

---

## Oportunidades de AI Identificadas

> Esta seção mapeia dados disponíveis mas subutilizados, que a Claude pode analisar para sugerir melhorias.

### 1. 🎯 Lead Scoring Preditivo

**Dados disponíveis**:
- `contacts.referral_data.sourceId` → anúncio de origem
- `lead_status_history.duration_seconds` → velocidade na jornada
- `messages` (count, volume de texto, áudios) → engajamento
- `conversations.first_response_at - conversations.created_at` → tempo de resposta do agente
- `contacts.lead_status` atual → label de treino

**Query base para dataset de treino**:
```sql
SELECT 
  c.id,
  c.origin,
  c.referral_data->>'sourceId' as ad_id,
  COUNT(m.id) as total_messages,
  COUNT(m.id) FILTER (WHERE m.is_from_me = false) as client_messages,
  AVG(LENGTH(m.content)) FILTER (WHERE m.is_from_me = false) as avg_message_length,
  COUNT(m.id) FILTER (WHERE m.message_type = 'audio') as audio_count,
  MIN(lah.time_to_assign_seconds) as time_to_assign,
  EXTRACT(EPOCH FROM (conv.first_response_at - conv.created_at)) as time_to_first_response,
  c.lead_status as label
FROM contacts c
LEFT JOIN conversations conv ON conv.contact_id = c.id
LEFT JOIN messages m ON m.conversation_id = conv.id
LEFT JOIN lead_assignment_history lah ON lah.contact_id = c.id
GROUP BY c.id, c.origin, c.referral_data, conv.first_response_at, conv.created_at, c.lead_status;
```

### 2. 📊 Otimização de Criativo por Conversão

**Cruzamento**:
- `meta_ads.ad_id` + `meta_ads.thumbnail_url` (visual do criativo)
- `conversations.referral_data->>'sourceId'` (leads que vieram deste ad)
- Taxa de conversão por lead de cada anúncio
- `meta_campaign_insights.cpc` + taxa real de conversão = CPL real

**Insight possível**: Identificar quais criativos geram leads que convertem mais (não apenas mais cliques).

### 3. ⏱️ Análise de Jornada por Origem

**Dados**:
- `lead_status_history.duration_seconds` por `previous_status`
- Segmentado por `contacts.origin`

**Insight possível**: Leads de CTWA vs Redirect têm velocidades diferentes em cada estágio do funil?

### 4. 🎤 Análise de Transcrições de Áudio

**Dado**: `messages.transcription` — texto de todos os áudios recebidos de leads.

**Possibilidades**:
- Detecção de objeções recorrentes ("caro", "não preciso agora")
- Extração de intenção ("quero comprar", "tenho interesse")
- Sentimento por estágio da jornada
- Identificação de palavras que precedem conversão

**Query**:
```sql
SELECT 
  c.lead_status,
  m.transcription
FROM messages m
JOIN conversations conv ON conv.id = m.conversation_id
JOIN contacts c ON c.id = conv.contact_id
WHERE m.message_type = 'audio'
  AND m.transcription_status = 'completed'
  AND m.is_from_me = false
  AND m.transcription IS NOT NULL
  AND c.tenant_id = '<tenant_id>';
```

### 5. 🕐 Melhor Horário para Anúncios

**Dados**:
- `conversations.created_at` (hora que o lead entrou)
- `conversations.referral_source = 'ctwa_ad'` (leads de anúncio)
- `contacts.lead_status` (se converteu)

**Query**:
```sql
SELECT 
  EXTRACT(HOUR FROM conv.created_at AT TIME ZONE 'America/Sao_Paulo') as hora,
  EXTRACT(DOW FROM conv.created_at AT TIME ZONE 'America/Sao_Paulo') as dia_semana,
  COUNT(DISTINCT c.id) as leads,
  COUNT(DISTINCT c.id) FILTER (WHERE c.lead_status LIKE '%Fechado%') as conversoes,
  ROUND(
    COUNT(DISTINCT c.id) FILTER (WHERE c.lead_status LIKE '%Fechado%')::numeric 
    / NULLIF(COUNT(DISTINCT c.id), 0) * 100, 2
  ) as taxa_conversao
FROM conversations conv
JOIN contacts c ON c.id = conv.contact_id
WHERE conv.referral_source = 'ctwa_ad'
  AND c.tenant_id = '<tenant_id>'
GROUP BY hora, dia_semana
ORDER BY taxa_conversao DESC;
```

### 6. 👤 Impacto do Agente na Conversão

**Dados**:
- `conversations.assigned_to` + `conversations.first_response_at`
- `contacts.lead_status` final
- `lead_assignment_history.time_to_assign_seconds`

**Insight possível**: Qual agente, com qual tempo de resposta, tem maior taxa de conversão por tipo de origem de lead?

---

## Estruturas JSONB Documentadas

### Resumo de todos os campos JSONB relevantes

| Tabela | Campo JSONB | Conteúdo |
|--------|-------------|----------|
| `contacts` | `referral_data` | Dados do anúncio Meta (CTWA) ou UTMs (Redirect) |
| `contacts` | `custom_fields` | Campos personalizados + array `conversoes` |
| `conversations` | `referral_data` | Espelho de `contacts.referral_data` |
| `conversation_events` | `data` | Contexto do evento (transfer, close, etc.) |
| `messages` | `reactions` | Emojis e quem reagiu |
| `company_settings` | `lead_distribution_agents` | Array de agentes com % e leads_received |
| `company_settings` | `business_hours` | Horários de funcionamento por dia da semana |
| `meta_adsets` | `targeting` | Segmentação completa de audiência |
| `meta_campaign_insights` | `actions` | Array de ações rastreadas pelo Meta |
| `flow_executions` | `variables` | Respostas do lead capturadas no chatbot |
| `flow_execution_logs` | `details` | Contexto de logs dos nós do fluxo |
| `call_logs` | `emotion_data` | Dados de análise emocional da chamada VoIP |
| `gamification_profiles` | `badges` | Conquistas do vendedor |

---

## Queries SQL de Referência

### Jornada Completa de um Lead

```sql
-- Substitua '<contact_uuid>' pelo ID real do contato
WITH lead_info AS (
  SELECT c.*, p.full_name as agent_name
  FROM contacts c
  LEFT JOIN profiles p ON p.id = c.assigned_to
  WHERE c.id = '<contact_uuid>'
),
status_history AS (
  SELECT lsh.*, p.full_name as changed_by_name
  FROM lead_status_history lsh
  LEFT JOIN profiles p ON p.id = lsh.changed_by
  WHERE lsh.contact_id = '<contact_uuid>'
  ORDER BY lsh.changed_at
),
conversation_list AS (
  SELECT conv.*, p.full_name as assigned_agent
  FROM conversations conv
  LEFT JOIN profiles p ON p.id = conv.assigned_to
  WHERE conv.contact_id = '<contact_uuid>'
  ORDER BY conv.created_at DESC
)
SELECT 
  'lead' as type, row_to_json(lead_info) as data FROM lead_info
UNION ALL
SELECT 'status_change', row_to_json(status_history) FROM status_history
UNION ALL
SELECT 'conversation', row_to_json(conversation_list) FROM conversation_list;
```

### Leads sem Atribuição por Mais de 1 Hora

```sql
SELECT 
  c.id,
  c.full_name,
  c.phone,
  c.origin,
  c.created_at,
  EXTRACT(EPOCH FROM (NOW() - c.created_at))/3600 as horas_sem_atribuicao
FROM contacts c
WHERE c.assigned_to IS NULL
  AND c.created_at > NOW() - INTERVAL '24 hours'
  AND c.tenant_id = '<tenant_id>'
ORDER BY c.created_at ASC;
```

### Performance de Agentes por Origem de Lead

```sql
SELECT 
  p.full_name as agente,
  c.origin,
  COUNT(DISTINCT c.id) as leads_recebidos,
  COUNT(DISTINCT c.id) FILTER (WHERE c.lead_status LIKE '%Fechado%') as conversoes,
  ROUND(AVG(EXTRACT(EPOCH FROM (conv.first_response_at - conv.created_at))/60), 1) as avg_resposta_min,
  ROUND(
    COUNT(DISTINCT c.id) FILTER (WHERE c.lead_status LIKE '%Fechado%')::numeric 
    / NULLIF(COUNT(DISTINCT c.id), 0) * 100, 2
  ) as taxa_conversao_pct
FROM contacts c
JOIN profiles p ON p.id = c.assigned_to
LEFT JOIN conversations conv ON conv.contact_id = c.id
WHERE c.tenant_id = '<tenant_id>'
  AND c.created_at >= NOW() - INTERVAL '30 days'
GROUP BY p.full_name, c.origin
ORDER BY taxa_conversao_pct DESC;
```

### Gasto Meta vs Leads vs Conversões

```sql
SELECT 
  mc.name as campanha,
  DATE_TRUNC('week', mci.date_start) as semana,
  SUM(mci.spend) as investimento,
  SUM(mci.impressions) as impressoes,
  SUM(mci.clicks) as cliques,
  COUNT(DISTINCT c.id) as leads_crm,
  COUNT(DISTINCT c.id) FILTER (WHERE c.lead_status LIKE '%Fechado%') as conversoes_crm,
  ROUND(SUM(mci.spend) / NULLIF(COUNT(DISTINCT c.id), 0), 2) as cpl_real,
  ROUND(SUM(mci.spend) / NULLIF(COUNT(DISTINCT c.id) FILTER (WHERE c.lead_status LIKE '%Fechado%'), 0), 2) as cpa_real
FROM meta_campaign_insights mci
JOIN meta_campaigns mc ON mc.id = mci.campaign_id
LEFT JOIN contacts c ON 
  c.referral_data->>'sourceId' IN (
    SELECT ma.ad_id FROM meta_ads ma WHERE ma.campaign_id = mc.id
  )
  AND DATE_TRUNC('week', c.created_at) = DATE_TRUNC('week', mci.date_start::date::timestamp)
WHERE mc.tenant_id = '<tenant_id>'
GROUP BY mc.name, semana
ORDER BY semana DESC, investimento DESC;
```

---

*Documento gerado automaticamente a partir da arquitetura real do banco Supabase. Última atualização: 2026-02-19.*
*Para análise com Claude: copie o conteúdo deste arquivo e cole como contexto, ou forneça a URL raw do GitHub deste arquivo.*
