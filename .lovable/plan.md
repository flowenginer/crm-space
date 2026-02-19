
# Criar docs/LEAD_DATA_ARCHITECTURE.md

## Objetivo

Criar um único arquivo Markdown no repositório (`docs/LEAD_DATA_ARCHITECTURE.md`) que documente com precisão toda a arquitetura de dados da jornada do lead no Supabase — usando os dados reais do banco, campos reais e exemplos reais de JSONB capturados diretamente. O arquivo será estruturado para que a Claude possa ler e sugerir otimizações de AI para campanhas Meta e análise de dados.

---

## O Que o Arquivo Vai Conter

### Seção 0 — Visão Geral da Jornada

Fluxo completo do dado desde o clique no anúncio até a conversão, mostrando como cada tabela se conecta:

```text
[Meta Ad / Instagram] 
       |
       | Click-to-WhatsApp (CTWA)
       v
[cloudapi-webhook] → [conversations.referral_data] + [contacts.referral_data]
       |                    |
       |              [messages]
       |
[whatsapp-webhook] → via UAZAPI/Z-API/Evolution
       |
[redirect-capture] → via links rastreados (redirect_campaigns)
       |
       +——————————————————+
                          |
                    [contacts] ← entidade central
                          |
          +———————————————+———————————————+
          |               |               |
   [conversations]  [lead_status_   [lead_assignment_
                     history]         history]
          |
   [messages]
          |
   [conversation_events]
          |
   [deals] (pipeline CRM)
          |
   [daily_metrics] + [gamification_events]
```

---

### Seção 1 — Tabela `contacts` (41 campos)

Documentação campo a campo com tipo, origem e significado:

**Identificação do Lead**
- `id` (uuid) — Chave primária gerada automaticamente
- `full_name` (text, obrigatório) — Nome do contato. Origem: WhatsApp profile name ou manual
- `phone` (text, obrigatório) — Telefone normalizado sempre com `55` + DDD + 9º dígito. Ex: `5511987654321`
- `email` (text) — E-mail, preenchido manualmente ou via importação
- `cpf_cnpj` (text) — Documento fiscal
- `birth_date` (date) — Data de nascimento
- `person_type` (text, default: `individual`) — Valores: `individual` | `company`
- `contact_type` (text, default: `customer`) — Tipo do contato no CRM

**Localização**
- `zip_code`, `street`, `number`, `complement`, `neighborhood`, `city`, `state`, `country` (default: `Brasil`)

**Status no CRM**
- `lead_status` (text, default: `new`) — Status atual do lead. Valores configuráveis via `lead_statuses`
- `lead_score` (integer, default: 0) — Score calculado de qualidade do lead
- `assigned_to` (uuid → profiles) — Agente responsável pelo lead
- `department_id` (uuid → departments) — Departamento associado
- `segment_id` (uuid → segments) — Segmento de mercado

**Rastreamento de Origem** ← campo crítico para AI
- `origin` (text) — Valores possíveis: `meta_ads` | `redirect` | `organic` | `linktree` | `manual` | `import`
- `origin_campaign` (text) — Nome da campanha de origem (ex: `Converse conosco`)
- `referral_data` (jsonb) — Dados completos do anúncio. Dois formatos possíveis:

  **Formato CTWA (Click-to-WhatsApp via Meta Cloud API):**
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

  **Formato Redirect (links rastreados com UTM):**
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

**Engajamento**
- `first_contact_at` — Timestamp do primeiro contato
- `last_interaction_at` — Última interação registrada
- `last_seen_at` — Última vez que o lead esteve online
- `is_online` (boolean) — Status de presença em tempo real
- `is_typing` (boolean) — Digitando no momento

**Negociação**
- `negotiated_value` (numeric) — Valor negociado
- `shirt_quantity` (integer) — Campo específico do negócio (qtd de camisas)

**Campos Customizáveis**
- `custom_fields` (jsonb, default: `{}`) — Campos extras definidos em `custom_field_definitions`. Também armazena `conversoes` (array de pedidos fechados)

**Bloqueio**
- `is_blocked` (boolean) — Lead bloqueado
- `blocked_reason` (text) — Motivo do bloqueio

**Chamadas VoIP**
- `call_permission_status` (text) — Status da permissão de chamada
- `call_permission_requested_at` — Timestamp da solicitação

---

### Seção 2 — Tabela `conversations` (38 campos)

**Relacionamentos**
- `contact_id` (uuid → contacts) — Lead associado
- `channel_id` (uuid → whatsapp_channels) — Canal de WhatsApp
- `assigned_to` (uuid → profiles) — Agente responsável pelo atendimento
- `department_id` (uuid → departments) — Departamento

**Status e Prioridade**
- `status` (text) — `pending` | `open` | `closed`
- `lead_status` (text) — Status do lead no momento da conversa
- `priority` (text) — `low` | `medium` | `high`
- `sla_status` (text) — `ok` | `warning` | `critical`

**Métricas de Tempo**
- `first_response_at` — Timestamp da primeira resposta do agente
- `total_active_time_seconds` — Tempo total de atendimento ativo
- `last_message_at` — Timestamp da última mensagem
- `last_client_message_at` — Última mensagem do cliente (para cálculo SLA)

**Origem do Anúncio** ← chave para cruzar com Meta Ads
- `referral_source` (text) — `ctwa_ad` | `redirect` | `organic`
- `referral_data` (jsonb) — Mesma estrutura de `contacts.referral_data`. Campo chave para identificar qual anúncio gerou a conversa. O `source_id` neste campo corresponde ao `ad_id` nas tabelas `meta_ads`

**Transferências**
- `transferred_from` (uuid → profiles) — Agente que transferiu
- `transferred_at` — Timestamp da transferência
- `transfer_note` (text) — Motivo/observação da transferência
- `is_new_transfer` (boolean) — Flag para destacar na fila

**Encerramento**
- `closed_at`, `closed_by` (uuid → profiles), `close_reason` (text)
- `reopen_count` (integer) — Quantas vezes foi reaberta
- `reopened_at`, `previous_close_reason`, `previous_closed_at`, `previous_closed_by`

**AI/Análise**
- `analysis_status` (text) — Status da análise automática
- `status_ia` (text) — Classificação feita por AI

**Mensagens**
- `last_message_preview` (text) — Preview da última mensagem
- `last_message_is_from_me` (boolean) — Se a última mensagem foi do agente
- `is_unread` (boolean), `unread_count` (integer)

---

### Seção 3 — Tabela `messages` (20 campos)

- `id`, `conversation_id`, `sender_id` (uuid → profiles), `contact_id`
- `content` (text) — Texto da mensagem
- `message_type` (text) — `text` | `image` | `audio` | `video` | `document` | `sticker` | `location` | `contact` | `reaction` | `template`
- `media_url` (text) — URL do arquivo no Supabase Storage (bucket: `conversation-attachments`)
- `media_mime_type` (text) — MIME type original do arquivo
- `is_from_me` (boolean) — `true` = agente enviou, `false` = cliente enviou
- `status` (text) — `sent` | `delivered` | `read` | `failed`
- `whatsapp_message_id` (text) — ID original da mensagem na plataforma WhatsApp
- `reply_to_message_id` (uuid → messages) — Para mensagens em resposta
- `reactions` (jsonb) — Ex: `{"😀": ["contact_id_1"], "❤️": ["contact_id_2"]}`
- `is_deleted` (boolean), `deleted_at`
- `transcription` (text) — Transcrição de mensagens de áudio (via edge function `transcribe-audio`)
- `transcription_status` (text) — `pending` | `processing` | `completed` | `failed`
- `trigger_processed` (boolean) — Se a mensagem já disparou triggers de automação

---

### Seção 4 — Rastreamento de Eventos Históricos

**`lead_status_history`** — Toda mudança de status do lead
- `contact_id`, `previous_status`, `new_status`, `changed_by` (uuid → profiles)
- `changed_at` — Timestamp exato da mudança
- `duration_seconds` — Tempo que ficou no status anterior

**`lead_assignment_history`** — Toda troca de agente responsável
- `contact_id`, `conversation_id`, `assigned_from`, `assigned_to`, `assigned_by`
- `assigned_at` — Timestamp
- `assignment_type` (text) — `auto_distribution` | `manual` | `transfer`
- `time_to_assign_seconds` — Tempo desde criação do contato até atribuição

**`conversation_events`** — Eventos de ação dentro de conversas
- `conversation_id`, `event_type`, `actor_id`
- `event_type` valores: `transfer` | `close` | `reopen` | `assign` | `channel_changed` | `priority_changed`
- `data` (jsonb) — Contexto do evento:
  ```json
  {
    "from_user": "uuid-agente-origem",
    "to_user": "uuid-agente-destino",
    "is_auto_distribution": true,
    "note": "Observação da transferência",
    "reason": "sold"
  }
  ```

---

### Seção 5 — Captura de Leads por Redirect (Links Rastreados)

**`redirect_campaigns`** — Links de captura com tracking
- `name`, `slug` — Identificação da campanha
- `distribution_mode` — `round_robin` | `percentage`
- `facebook_pixel_id`, `gtm_container_id`, `google_analytics_id` — Pixels de rastreamento
- `department_id`, `tag_id` — Atribuição automática ao capturar lead
- `total_clicks`, `total_leads`, `views_count` — Métricas acumuladas

**`redirect_campaign_channels`** — Canais vinculados à campanha (múltiplos WhatsApps)
- `campaign_id`, `channel_id`, `percentage`, `position`, `is_active`

**`redirect_logs`** — Cada clique/acesso ao link
- `campaign_id`, `contact_id`, `channel_id`
- `phone`, `country_code`, `ip_address`, `user_agent`
- `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`
- `referrer` — URL de origem
- `converted` (boolean) — Se o lead converteu

---

### Seção 6 — Meta Ads (Hierarquia Completa)

Dados sincronizados via OAuth + API do Meta (edge functions `meta-sync`, `meta-auto-sync`):

**`meta_ad_accounts`**
- `account_id` (text) — ID da conta no Meta (ex: `act_123456`)
- `account_name`, `business_id`, `currency`, `timezone`
- `access_token` — Token OAuth do usuário
- `auto_sync_enabled`, `sync_interval_hours`, `last_auto_sync_at`

**`meta_campaigns`**
- `campaign_id` (text) — ID da campanha no Meta
- `name`, `objective`, `status` (`ACTIVE`|`PAUSED`|`DELETED`)
- `daily_budget`, `lifetime_budget`, `start_time`, `stop_time`

**`meta_adsets`**
- `adset_id` (text) — ID do conjunto de anúncios
- `daily_budget`, `lifetime_budget`
- `targeting` (jsonb) — Segmentação completa da audiência

**`meta_ads`**
- `ad_id` (text) — ID do anúncio. Este ID cruza com `referral_data.sourceId` nos contatos e conversas
- `name`, `status`, `creative_id`
- `thumbnail_url`, `preview_url` — URLs das imagens do criativo

**`meta_campaign_insights`** — Métricas diárias de performance
- `date_start`, `date_stop`
- `impressions`, `clicks`, `reach`
- `spend` (numeric) — Valor gasto
- `ctr`, `cpc`, `cpm` — Métricas de custo
- `conversions`, `cost_per_conversion`
- `actions` (jsonb) — Array de ações detalhadas da Meta API

---

### Seção 7 — Como Cruzar Meta Ads com Leads (O Ponto Crítico)

Explicação de como conectar os dados de campanha com os leads no CRM:

```text
meta_ads.ad_id
    ↕ (igual a)
conversations.referral_data->>'source_id'   (CTWA via Cloud API)
contacts.referral_data->>'utm_term'          (Redirect com UTM)

meta_campaigns.campaign_id
    ↕ (igual a)  
contacts.referral_data->>'campaign_id'       (Redirect)

Exemplo de query de ROI:
SELECT 
  c.origin_campaign,
  COUNT(DISTINCT c.id) as leads,
  COUNT(DISTINCT CASE WHEN c.lead_status = '07 - Pedido Fechado' THEN c.id END) as conversions,
  SUM(mci.spend) as total_spend
FROM contacts c
LEFT JOIN meta_campaign_insights mci ON ...
GROUP BY c.origin_campaign
```

---

### Seção 8 — Distribuição de Leads

Configurado em `company_settings` (jsonb):
- `lead_distribution_enabled` (boolean)
- `lead_distribution_type` — `sequential` | `percentage`
- `lead_distribution_department_id` (uuid)
- `lead_distribution_agents` (jsonb array):
  ```json
  [
    {"user_id": "uuid", "percentage": 40, "leads_received": 12, "is_active": true, "position": 1},
    {"user_id": "uuid", "percentage": 40, "leads_received": 11, "is_active": true, "position": 2},
    {"user_id": "uuid", "percentage": 20, "leads_received": 6,  "is_active": false, "position": 3}
  ]
  ```
- `conversion_status_ids` (array de uuid) — Status que definem "conversão"

---

### Seção 9 — Automações e Fluxos

**`chatbot_flows`** — Definição dos fluxos
- `channel_ids` (array) — Canais onde o fluxo atua
- `priority`, `is_active`, `is_draft`
- `total_executions`, `total_completions`, `total_errors`

**`flow_executions`** — Instâncias de execução por lead
- `flow_id`, `conversation_id`, `contact_id`, `channel_id`
- `status` — `running` | `completed` | `failed` | `waiting`
- `variables` (jsonb) — Variáveis capturadas durante o fluxo (respostas do lead)
- `waiting_until` — Timestamp para delays programados

**`flow_execution_logs`** — Log de cada nó executado
- `execution_id`, `node_id`
- `log_type` — `info` | `error` | `debug`
- `details` (jsonb)

---

### Seção 10 — Métricas Agregadas

**`daily_metrics`** — Por agente/departamento/dia
- `date`, `user_id`, `department_id`
- `new_contacts`, `conversations_started`, `conversations_closed`, `conversations_transferred`
- `messages_sent`, `messages_received`
- `avg_first_response_seconds`, `avg_resolution_seconds`
- `sla_ok`, `sla_warning`, `sla_critical`
- `deals_created`, `deals_won`, `deals_lost`, `revenue`

**`deals`** — Pipeline CRM
- `pipeline_id`, `stage_id`, `contact_id`, `assigned_to`
- `value` (numeric), `status` (`open`|`won`|`lost`)
- `expected_close_date`, `closed_at`, `lost_reason`
- `days_in_stage`, `stage_entered_at`

**`gamification_profiles`** — Performance de vendedores
- Pontos, nível, ranking, badges

---

### Seção 11 — Oportunidades para AI (Gaps e Sugestões)

Dados disponíveis mas subutilizados que a Claude pode analisar:

1. **Lead Scoring com AI**: `referral_data.sourceId` + `lead_status_history.duration_seconds` + `messages` (volume e sentiment) → score preditivo de conversão
2. **Otimização de Criativo**: cruzar `meta_ads.ad_id` ↔ `conversations.referral_data` → taxa de conversão por criativo
3. **Análise de Jornada por Origem**: tempo médio em cada status (`lead_status_history.duration_seconds`) segmentado por `contacts.origin`
4. **Transcrições de Áudio**: `messages.transcription` contém texto de áudios — disponível para análise de objeções e intenções
5. **Padrão de Resposta**: `conversations.first_response_at - conversations.created_at` por agente e canal → impacto na conversão
6. **Melhor Horário de Anúncio**: cruzar `conversations.created_at` (hora do dia) com `referral_source = 'ctwa_ad'` → horários com maior taxa de abertura

---

## Seção Técnica — Detalhes de Implementação

**Arquivo a criar**: `docs/LEAD_DATA_ARCHITECTURE.md`

O arquivo vai ter aproximadamente 500-600 linhas em Markdown puro, sem dependências externas, que a Claude pode ler diretamente pela URL do GitHub.

**Estrutura de Seções**:
1. Visão Geral e Diagrama de Fluxo
2. Tabela de Referência Rápida (todas as tabelas em uma tabela Markdown)
3. Seção detalhada por domínio (contatos → conversas → mensagens → histórico → Meta Ads → distribuição → automações → métricas)
4. Como Cruzar Dados (queries de exemplo com SQL para ROI, conversão por anúncio, etc.)
5. Estruturas JSONB Documentadas com exemplos reais do banco
6. Oportunidades de AI identificadas

**Não será feito**: Nenhum dado será enviado para fora. O arquivo ficará apenas no repositório GitHub, acessível pela URL pública do repo para que você cole no contexto da Claude.
