# PRD - Modulo de Conversas (Chat) | Space Sports CRM

**Versao:** 1.0
**Data:** 23/02/2026
**Status:** Documentacao do estado atual

---

## 1. Visao Geral

O modulo de Conversas e o nucleo do CRM Space Sports. Ele centraliza toda a comunicacao com clientes via WhatsApp (oficial e nao-oficial), permitindo atendimento em tempo real, automacoes, agendamento de mensagens, gestao de leads e integracao com pedidos/orcamentos.

### Arquitetura Tecnica
- **Frontend:** React + TypeScript + TanStack Query (React Query)
- **Backend:** Supabase (PostgreSQL + Realtime + Edge Functions + Storage)
- **Estado:** React Query para cache + Supabase Realtime para sincronizacao
- **Canais:** WhatsApp via provedores (Evolution API, UAZAPI, Z-API)
- **Automacoes:** n8n (self-hosted) + Edge Functions

---

## 2. Funcionalidades Implementadas

### 2.1 Interface Principal de Conversas

**Pagina:** `src/pages/Conversations.tsx` (~6.640 linhas)

**Layout:**
- Painel esquerdo: Lista de conversas com filtros
- Painel central: Thread de mensagens
- Painel direito: Sidebar do contato (detalhes, tags, pedidos)
- Mobile: Navegacao por swipe entre paineis (`MobileSwipeNavigation.tsx`)

---

### 2.2 Mensagens

#### 2.2.1 Tipos de Mensagem Suportados
| Tipo | `message_type` | Descricao |
|------|---------------|-----------|
| Texto | `text` | Mensagem de texto simples com formatacao WhatsApp |
| Audio | `audio` | Gravacao de voz ou arquivo de audio |
| Imagem | `image` | Fotos e imagens (JPEG, PNG, GIF, WebP) |
| Video | `video` | Arquivos de video (MP4, WebM) |
| Documento | `document` | PDF, DOC, DOCX, XLS, XLSX, TXT |
| Sticker | `sticker` | Figurinhas do WhatsApp |
| Localizacao | `location` | Coordenadas geograficas |

#### 2.2.2 Envio de Mensagens
- **Hook:** `useSendMessage()` com optimistic updates
- **Fluxo:**
  1. Usuario digita/anexa conteudo
  2. Mensagem inserida otimisticamente no cache
  3. INSERT na tabela `messages`
  4. Trigger atualiza `conversations` (last_message_at, preview, unread)
  5. Evento realtime sincroniza outros clientes
  6. n8n webhook processa e envia via provedor WhatsApp

#### 2.2.3 Status de Mensagem
| Status | Descricao |
|--------|-----------|
| `pending` | Aguardando envio |
| `sent` | Enviada ao servidor |
| `delivered` | Entregue ao dispositivo |
| `read` | Lida pelo destinatario |
| `failed` | Falha no envio |

#### 2.2.4 Acoes em Mensagens
- **Editar** (`useEditMessage`) - Edita texto, sincroniza com WhatsApp
- **Excluir** (`useDeleteMessage`) - Soft delete, chama API do provedor
- **Reagir** (`useReactToMessage`) - Reacoes com emoji (JSONB `reactions`)
- **Responder** (`reply_to_message_id`) - Reply threading com preview
- **Copiar** - Copiar texto da mensagem

#### 2.2.5 Gravacao de Audio
- **Componente:** `AudioRecorder.tsx` / `CompactAudioRecorder.tsx`
- **Biblioteca:** `Mp3Recorder` (customizada com lamejs)
- **Configuracao:** 44100Hz, mono, 128kbps MP3
- **Fluxo:**
  1. Solicita permissao do microfone
  2. Captura via `getUserMedia()` com cancelamento de eco
  3. Encoding MP3 em tempo real via ScriptProcessorNode
  4. Upload para bucket `conversation-attachments`
  5. Envia como mensagem tipo `audio`
- **Formatos aceitos upload:** MP3, OGG, WAV, M4A, WebM

#### 2.2.6 Envio de Arquivos
- **Componente:** `FileUploader.tsx`
- **Limite:** 50MB por arquivo
- **Categorias:**
  - `media`: Imagens, videos, PDF
  - `documents`: Qualquer tipo de documento
- **Features:** Drag-and-drop, validacao de tipo, preview, progresso
- **Storage:** Bucket `conversation-attachments` (publico, 10MB limite por arquivo)

#### 2.2.7 Visualizacao de Midia
- **Imagens:** `ImagePreviewDialog.tsx` - Zoom (0.5x-3x), pan/drag, download, double-click zoom
- **Documentos:** `DocumentPreviewDialog.tsx` - Preview e download
- **Download:** `MediaDownloadButton.tsx` - Download com MIME type correto

---

### 2.3 Emoji e Formatacao

#### 2.3.1 Emoji Picker
- **Componente:** `EmojiPickerButton.tsx`
- **Quick emojis:** 8 emojis rapidos (configuravel)
- **Picker completo:** Via `emoji-picker-react` com busca
- **Tema:** Suporte dark/light mode

#### 2.3.2 Formatacao WhatsApp
- **Negrito:** `*texto*`
- **Italico:** `_texto_`
- **Tachado:** `~texto~`
- **Variaveis:** `{{nome}}`, `{{telefone}}`, `{{email}}`, etc.

---

### 2.4 Templates (Mensagens Rapidas)

**Pagina:** `src/pages/QuickMessages.tsx`

#### 2.4.1 Categorias de Templates
| Categoria | Descricao |
|-----------|-----------|
| `messages` | Templates de texto |
| `audios` | Templates com audio |
| `medias` | Templates com imagem/video |
| `documents` | Templates com documentos |
| `funnels` | Fluxos de chatbot |
| `triggers` | Gatilhos de automacao |

#### 2.4.2 Estrutura do Template
```
message_templates:
  - id, title, content, category
  - folder_id (organizacao por pastas)
  - variables (JSONB - variaveis dinamicas)
  - content_blocks[] (multiplos blocos de conteudo)
  - media_url, media_type, media_name
  - audio_first (boolean - audio antes do texto)
  - usage_count (contador de uso)
  - is_favorite, shortcut
  - created_by, department_id
```

#### 2.4.3 Quick Templates (Atalhos)
- **Componente:** `QuickTemplatesPopover.tsx`
- Ate 5 posicoes de atalho por usuario
- Tabs: Messages, Audios, Midias, Docs, Funis, Meta
- Busca e envio rapido
- Contagem de uso por template
- **Config:** `QuickTemplatesConfigModal.tsx`

#### 2.4.4 Meta Templates (WhatsApp Business API)
- Templates aprovados pela Meta
- Variaveis parametrizadas
- Modal de preenchimento: `MetaTemplateUseModal`
- Necessarios para mensagens fora da janela de 24h

#### 2.4.5 Variaveis Disponiveis
`nome`, `telefone`, `email`, `produto`, `valor`, `quantidade`, `data`, `atendente`

---

### 2.5 Agendamento de Mensagens

**Pagina:** `src/pages/ScheduledMessages.tsx`

#### 2.5.1 Agendamento
- **Modal:** `ScheduleMessageModal.tsx`
- Selecao de data e hora
- Mensagem de texto ou template
- Suporte a audio e arquivos
- Emoji picker integrado
- Recorrencia (via `recurrence_rule`)

#### 2.5.2 Gerenciamento
- **Status:** Scheduled, Processing, Sent, Failed, Cancelled
- **Cards de estatisticas:** Total, Pendente, Enviado, Falhou, Cancelado
- **Acoes:** Visualizar, Editar, Enviar Agora, Cancelar, Excluir
- **Filtros:** Busca, status, periodo, agente
- **Paginacao** e **auto-refresh** (30s)

#### 2.5.3 Tabela `scheduled_messages`
```
id, contact_id, conversation_id, channel_id, template_id
content, message_type, media_url, variables
scheduled_for, recurrence_rule
status (scheduled|processing|sent|failed|cancelled)
error_message, attempts, sent_at, created_by
```

---

### 2.6 Callbacks / Lembretes de Retorno

- **Aba:** Tab "Lembretes de Retorno" em ScheduledMessages
- **Status:** Atrasado, Hoje, Pendente
- **Acoes:** Marcar como concluido, editar, abrir conversa, cancelar
- **Hooks:** `usePendingCallbacks`, `useMarkCallbackComplete`, `useDeleteCallback`, `useUpdateCallback`

---

### 2.7 Registro de Ligacoes

- **Modal:** `CallLogModal.tsx`
- **Tabela:** `call_logs`
- **Campos:** data, hora, resultado, notas, agendar follow-up
- **Resultados pre-definidos** (tabela `call_results`):
  - Nao atendeu, Ocupado, Pediu retorno, Interessado
  - Sem interesse, Fechou negocio, Caixa postal, Numero invalido

---

### 2.8 Filtros e Busca

#### 2.8.1 Filtros de Conversa
| Filtro | Opcoes |
|--------|--------|
| **Atribuicao** | Minhas, Nao atribuidas, Todas, Pendentes |
| **Status** | Ativas, Abertas, Pendentes, Fechadas, Todas |
| **Canal** | Por canal WhatsApp |
| **Departamento** | Por departamento |
| **Agente** | Por agente especifico |
| **Origem** | Meta Ads, WhatsApp, Todas |
| **Data** | Hoje, Ontem, Esta semana, Semana passada, Este mes, Mes passado, Personalizado |
| **Tags** | Por tag(s) aplicada(s) |
| **Lead Status** | Por status do lead |
| **Nao lidas** | Filtro de nao lidas |
| **Nao respondidas** | Sem resposta do agente |
| **Cliente nao respondeu** | Sem resposta do cliente |
| **Ordenacao** | Mais recente, Mais antiga |

#### 2.8.2 Busca Global
- **Componente:** `GlobalSearchPopover.tsx` + `SearchResultsList.tsx`
- **Hook:** `useGlobalSearch`
- Busca em contatos e mensagens
- Busca accent-insensitive via `search_contacts_unaccent()`
- Busca paginada via `search_contacts_paginated()`

#### 2.8.3 Contadores em Tempo Real
- **Hook:** `useConversationCounts` / `useAllConversationCounts`
- Contagem por: canal, departamento, agente, origem, data, tag, lead status
- Cache: 2-5 min staleTime, 3-5 min refetch
- Timezone-aware (cached em sessionStorage)

---

### 2.9 Atribuicao e Roteamento

#### 2.9.1 Filas (Queues)
```
queues:
  - id, name, description, color, icon
  - department_id, max_per_agent, priority
  - auto_assign (boolean)
  - business_hours (JSONB - horarios por dia)
  - is_active

queue_agents:
  - queue_id, agent_id, is_active
```

#### 2.9.2 Transferencia de Conversa
- **Modal:** `TransferModal.tsx`
- **Hook:** `useTransferConversation()`
- **Tipos:** Para usuario ou para departamento
- **Fluxo:**
  1. Selecionar tipo (usuario/departamento)
  2. Filtrar por departamento
  3. Ver disponibilidade do agente
  4. Adicionar nota opcional
  5. Opcao "Fixar para mim" / "Desfixar"
  6. RPC `transfer_conversation()` executa no banco
  7. Broadcast via canal `live-transfers`
  8. Cache atualizado otimisticamente (remove do sender, adiciona ao receiver)
- **Evento registrado:** `conversation_events` tipo `transfer`

#### 2.9.3 Compartilhamento de Conversa
- **Modal:** `ShareModal.tsx`
- **Hook:** `useShareConversation()`
- **Tipos:** Para usuario ou departamento inteiro
- **Permissoes:** `view` ou `edit`
- Nota opcional
- Lista de compartilhamentos ativos com opcao de remover
- **Tabela:** `shared_conversations`

#### 2.9.4 Operacoes em Massa (Bulk)
- **Barra:** `BulkActionsBar.tsx` (animada com Framer Motion)
- **Hook:** `useBulkConversationActions.ts`
- **Acoes disponiveis:**
  - Transferir em massa (`useBulkTransfer`) - sequencial com 100ms delay
  - Fechar em massa (`useBulkCloseConversations`) - chunks de 5
  - Adicionar tag em massa (`useBulkAddTag`) - batches de 50
  - Alterar lead status em massa (`useBulkUpdateLeadStatus`)
  - Reabrir em massa (`useBulkReopenConversations`)
  - Distribuir entre agentes (`useBulkDistribute`) - round-robin
  - Retornar ao agente original (`useBulkReturnToOriginalAgent`)

---

### 2.10 Sidebar do Contato

**Componente:** `ConversationSidebar.tsx`

#### 2.10.1 Informacoes do Contato
- Avatar, nome, telefone, email
- Endereco completo (rua, cidade, estado, CEP)
- CPF/CNPJ
- Data de nascimento
- Data de criacao
- Notas

#### 2.10.2 Gestao de Lead
- **Lead Status:** Seletor dinamico (`useLeadStatuses`)
  - Opcoes: new, active, qualified, unqualified, client
- **Segmento:** Seletor com criacao inline (`useSegments`)
- **Valor negociado:** Campo numerico
- **Tags:** Adicionar/remover tags no contato
- **Lead Score:** Pontuacao do lead

#### 2.10.3 Orcamentos e Pedidos
- **Orcamentos:** `QuoteSelectionModal.tsx`
  - Status: Rascunho, Enviado, Aprovado, Rejeitado, Expirado, Convertido
  - Criar novo, reabrir, ver detalhes inline
  - Alerta de orcamento pendente (`QuotePendingAlert.tsx`)
- **Pedidos:** `OrderSelectionModal.tsx`
  - Status customizaveis (`order_statuses`)
  - Historico de status (`order_status_history`)
  - Detalhes inline com itens e pagamentos

#### 2.10.4 Acoes na Sidebar
- Agendar mensagem
- Transferir conversa
- Compartilhar conversa
- Fechar conversa (com motivo)
- Reabrir conversa
- Fixar/desafixar conversa
- Link de pagamento (`PaymentLinkModal.tsx`)
- Registrar ligacao (`CallLogModal.tsx`)

---

### 2.11 Notas Internas

- **Hook:** `useInternalNotes`
- **Tabela:** `internal_notes`
- CRUD completo (criar, editar, excluir)
- Fixar nota importante (`is_pinned`)
- Visivel apenas para agentes (nao enviado ao cliente)
- Vinculado a `conversation_id` e `author_id`

---

### 2.12 Eventos de Conversa

**Hook:** `useConversationEvents`
**Tabela:** `conversation_events`

| Tipo de Evento | Componente | Descricao |
|---------------|------------|-----------|
| `transfer` | `TransferEventCard.tsx` | Transferencia entre agentes/departamentos |
| `close` | `CloseEventCard.tsx` | Fechamento com motivo |
| `reopen` | `ReopenEventCard.tsx` | Reabertura de conversa |
| `share` | `ShareEventCard.tsx` | Compartilhamento |
| `share_cancelled` | `ShareCancelledEventCard.tsx` | Cancelamento de compartilhamento |
| `channel_changed` | - | Mudanca de canal |
| `auto_reassign` | - | Reatribuicao automatica |

---

### 2.13 Status de Conversa

| Status | Descricao |
|--------|-----------|
| `open` | Conversa ativa em atendimento |
| `pending` | Aguardando atribuicao ou resposta |
| `closed` | Conversa encerrada |

**Campos adicionais:**
- `closed_at`, `closed_by` - Dados do fechamento
- `close_reason` - Motivo do fechamento (tabela `close_reasons`)
- `first_response_at` - Tempo da primeira resposta (SLA)
- `sla_status` - Status do SLA
- `priority` - high, medium, low

---

### 2.14 Canais de Comunicacao

#### 2.14.1 Tabela `whatsapp_channels`
```
id, name, phone, channel_id, type (unofficial|business)
status (connected|disconnected|connecting)
qr_code, qr_expires_at, battery_level
last_sync_at, messages_sent/received (total e today)
department_id, provider_id, instance_id, instance_token
webhook_url, session_data (JSONB)
```

#### 2.14.2 Provedores Suportados
| Provedor | Codigo | Tipo |
|----------|--------|------|
| Evolution API | `evolution` | WhatsApp nao-oficial |
| UAZAPI | `uazapi` | WhatsApp nao-oficial |
| Z-API | `zapi` | WhatsApp nao-oficial |

**Tabela:** `whatsapp_providers` - configuracao por provedor (base_url, api_key, tokens)

#### 2.14.3 Janela de 24 Horas (WhatsApp)
- **Hook:** `use24hWindow`
- Rastreia quando a ultima mensagem do cliente foi recebida
- Apos 24h sem mensagem do cliente, so pode enviar Meta Templates
- Exibe tempo restante no UI

#### 2.14.4 Iniciar Nova Conversa
- **Componente:** `StartConversation.tsx`
- Input de telefone com validacao de formato brasileiro
- Busca contato existente
- Criar novo contato se nao existir
- Selecao de canal (se multiplos)
- Deteccao de contato bloqueado
- Aviso de conversas abertas existentes

---

### 2.15 Tempo Real (Realtime)

#### 2.15.1 Canais de Subscricao
| Canal | Evento | Debounce | Acao |
|-------|--------|----------|------|
| `messages-live:{id}` | INSERT | 500ms | Adiciona ao cache + refetch |
| `messages-live:{id}` | UPDATE | 200ms | Invalida query |
| `conversations-updates` | UPDATE | - | Smart: close=remove, transfer=add/remove |
| `conversations-updates` | INSERT | 300ms | Refresh lista |
| `global-conversation-events` | INSERT | - | Processa transfer/close/reopen |
| `live-transfers` | Broadcast | - | Notificacao instantanea ao destinatario |
| `new-conversations` | Broadcast | - | Nova conversa tenant-wide |
| `conv-details:{id}` | UPDATE contacts | 500ms | Atualiza sidebar |
| `conv-details:{id}` | INSERT/DELETE contact_tags | 500ms | Atualiza tags |

#### 2.15.2 Indicador de Digitacao
- **Hook:** `useTypingIndicator`
- Usa Supabase Presence
- Auto-stop apos 3 segundos
- Exibido na area de mensagens

#### 2.15.3 Fallback de Polling
- Intervalo: 45 segundos
- Ativado somente se nenhum evento realtime em 30s
- Desativado quando tab esta oculta

#### 2.15.4 Tabelas com Realtime (REPLICA IDENTITY FULL)
- `messages`
- `conversations`
- `scheduled_messages`
- `activity_log`

---

### 2.16 Chat Interno (Entre Agentes)

**Pagina:** `src/pages/InternalChat.tsx`

#### 2.16.1 Funcionalidades
- Threads diretas 1-on-1 entre agentes
- Mensagens de texto, audio, arquivos
- Reply-to (resposta a mensagem especifica)
- Contador de nao lidas por thread
- Preview da ultima mensagem
- Busca de membros da equipe
- Notificacao sonora (`/notification.mp3`) com unlock automatico
- Toast notification com nome do remetente

#### 2.16.2 Componentes
- `InternalChatSidebar.tsx` - Lista de threads
- `InternalChatArea.tsx` - Area de mensagens
- `InternalChatHeader.tsx` - Cabecalho
- `InternalChatInput.tsx` - Input com audio, emoji, arquivos
- `InternalChatMessageItem.tsx` - Bolha de mensagem

#### 2.16.3 Hooks
- `useInternalChatThreads()` - RPC `get_internal_chat_threads`
- `useInternalChatMessages(threadId)` - Mensagens do thread
- `useInternalChatUnreadCount()` - RPC `get_internal_chat_unread_count`
- `useSendInternalMessage()` - Envio com media/reply
- `useStartInternalChat(userId)` - RPC `find_or_create_direct_thread`
- `useMarkThreadAsRead()` - Marca como lido
- `useInternalChatRealtime(threadId)` - Subscricao realtime

---

### 2.17 Pesquisa de Satisfacao

- **Hook:** `useSatisfactionConfig`
- **Tipos:** NPS (0-10) ou CSAT (1-5)
- **Fluxo:**
  1. Conversa fechada
  2. Edge Function `process-satisfaction` agendada
  3. Delay configuravel antes do envio
  4. Respeita horario comercial
  5. Auto-fecha conversa ao receber resposta
- **Tabelas:** `satisfaction_config`, `satisfaction_surveys`

---

### 2.18 Notificacoes

#### 2.18.1 Configuracao por Usuario
```
notification_settings:
  - new_messages (boolean)
  - new_deals (boolean)
  - stage_changes (boolean)
  - sla_alerts (boolean)
  - daily_summary (boolean)
  - email_enabled (boolean)
  - push_enabled (boolean)
  - whatsapp_enabled (boolean)
```

#### 2.18.2 Contadores
- **Hook:** `useMyWaitingConversations` - Conversas aguardando resposta
- **Realtime:** Canal `my-waiting-realtime` com debounce 500ms
- **RPC:** `get_agent_waiting_conversations(p_agent_id)`

---

### 2.19 Integracoes

#### 2.19.1 Meta Ads
- Rastreamento de origem `meta_ads` vs `whatsapp`
- Dados de referral na conversa (`referral_source`, `referral_data`)
- Tabelas: `meta_ad_accounts`, `meta_campaigns`, `meta_adsets`, `meta_ads`, `meta_campaign_insights`
- OAuth flow para conexao

#### 2.19.2 Bling ERP
- Integracao de pedidos/estoque
- Tabelas: `bling_integration_config`, `bling_sync_logs`, `bling_status_mappings`
- Sincronizacao de status

#### 2.19.3 n8n Workflows
- Webhook para processamento de mensagens
- Automacoes de roteamento/distribuicao
- Disparo de templates
- Integracao com canais WhatsApp

#### 2.19.4 Chatbot Flows
- **Hook:** `useChatbotFlows`
- Integrado ao `QuickTemplatesPopover`
- Fluxos automatizados de conversa

---

## 3. Schema do Banco de Dados (Tabelas Principais)

### 3.1 Tabelas Core de Conversas

| Tabela | Registros Relacionados | Descricao |
|--------|----------------------|-----------|
| `conversations` | Central | Conversa entre agente e contato |
| `messages` | Por conversa | Mensagens individuais |
| `contacts` | Por conversa | Dados do cliente |
| `profiles` | Agentes | Usuarios do sistema |
| `whatsapp_channels` | Por conversa | Canal de comunicacao |
| `conversation_tags` | N:N | Tags por conversa |
| `conversation_events` | Por conversa | Auditoria de eventos |
| `internal_notes` | Por conversa | Notas privadas |
| `shared_conversations` | Por conversa | Compartilhamentos |
| `pinned_conversations` | Por usuario | Conversas fixadas |

### 3.2 Tabelas de Templates e Agendamento

| Tabela | Descricao |
|--------|-----------|
| `message_templates` | Templates de mensagem |
| `template_folders` | Organizacao por pasta |
| `scheduled_messages` | Mensagens agendadas |
| `meta_message_templates` | Templates aprovados Meta |

### 3.3 Tabelas de Roteamento

| Tabela | Descricao |
|--------|-----------|
| `queues` | Filas de atendimento |
| `queue_agents` | Agentes por fila |
| `departments` | Departamentos |
| `user_departments` | Usuarios por departamento |
| `close_reasons` | Motivos de fechamento |

### 3.4 Tabelas de Pedidos/Orcamentos

| Tabela | Descricao |
|--------|-----------|
| `orders` | Pedidos |
| `order_items` | Itens do pedido |
| `order_payments` | Pagamentos |
| `order_statuses` | Status customizaveis |
| `order_status_history` | Historico de status |
| `quotes` | Orcamentos |
| `quote_items` | Itens do orcamento |
| `quote_expiration_notifications` | Notificacoes de vencimento |

---

## 4. Fluxos Criticos

### 4.1 Fluxo de Envio de Mensagem
```
Usuario digita → useSendMessage() → Optimistic Update (cache)
    → INSERT messages → Trigger atualiza conversations
    → Realtime event → Outros clientes sincronizam
    → n8n webhook → Provedor WhatsApp → Entrega ao cliente
```

### 4.2 Fluxo de Transferencia
```
Seleciona destinatario → useTransferConversation()
    → Optimistic: remove do cache do sender
    → RPC transfer_conversation() → Atualiza assigned_to
    → INSERT conversation_events (transfer)
    → Broadcast 'live-transfers' → Receiver notificado
    → Receiver: adiciona ao cache + notificacao toast
```

### 4.3 Fluxo de Upload de Arquivo
```
Seleciona arquivo → Validacao (tipo + tamanho 50MB)
    → uploadAttachment() → Supabase Storage
    → Gera URL publica → useSendMessage({ media_url })
    → INSERT messages com media_url + media_mime_type
```

### 4.4 Fluxo de Agendamento
```
Abre ScheduleMessageModal → Seleciona data/hora + conteudo
    → INSERT scheduled_messages (status: scheduled)
    → n8n cron verifica periodicamente
    → Quando chega a hora: status → processing → sent/failed
```

### 4.5 Fluxo de Nova Conversa (Inbound)
```
Cliente envia WhatsApp → Webhook do provedor
    → n8n processa → Busca/cria contato
    → Busca/cria conversa → INSERT messages
    → Roteamento: fila → departamento → agente
    → Broadcast 'new-conversations' → UI atualiza
```

---

## 5. Permissoes e Seguranca

### 5.1 Roles
| Role | Descricao |
|------|-----------|
| `admin` | Acesso total |
| `supervisor` | Visualiza tudo, gerencia equipe |
| `vendedor` | Ve apenas suas conversas + nao atribuidas |
| `designer` | Acesso limitado |
| `sac` | Atendimento ao cliente |

### 5.2 Permissoes de Conversa
- `can_view_all_conversations` - Ve todas as conversas
- `can_transfer_freely` - Transfere sem restricao
- Filtragem por departamento via `user_departments`
- RLS policies em todas as tabelas

### 5.3 Multi-Tenancy
- Todas as queries filtradas por `tenant_id`
- Funcoes: `get_user_tenant_id()`, `user_belongs_to_tenant()`
- Isolamento completo entre tenants

---

## 6. Metricas e Analytics

### 6.1 Tabela `daily_metrics`
```
date, user_id, department_id
new_contacts, conversations_started, conversations_closed
conversations_transferred, messages_sent, messages_received
avg_first_response_seconds, avg_resolution_seconds
sla_ok, sla_warning, sla_critical
deals_created, deals_won, deals_lost, revenue
```

### 6.2 Contadores em Tempo Real
- Conversas ativas/abertas/pendentes/fechadas
- Conversas aguardando resposta
- Por canal, departamento, agente, tag, lead status, origem

### 6.3 SLA
- `first_response_at` - Timestamp da primeira resposta
- `sla_first_response_minutes` - Config em `company_settings`
- `sla_resolution_minutes` - Config em `company_settings`
- `sla_status` - Tracking por conversa

---

## 7. Extensoes PostgreSQL Utilizadas

| Extensao | Uso |
|----------|-----|
| `pg_trgm` | Busca por similaridade (trigram) |
| `pg_cron` | Jobs agendados (expiracao, limpeza) |
| `pg_net` | Chamadas HTTP do banco |
| `unaccent` | Busca sem acentos |

---

## 8. Storage Buckets

| Bucket | Limite | Acesso | Tipos |
|--------|--------|--------|-------|
| `conversation-attachments` | 10MB | Publico | JPEG, PNG, GIF, WebP, MP4, WebM, MP3, OGG, PDF, DOC, XLS, TXT |
| `internal-email-attachments` | - | Autenticado | Todos |
| `internal-chat-attachments` | - | Autenticado | Midia e documentos |

---

## 9. Componentes React (Inventario Completo)

### Conversas (`src/components/conversations/`)
| Componente | Descricao |
|------------|-----------|
| `ConversationSidebar.tsx` | Sidebar de detalhes do contato |
| `GlobalSearchPopover.tsx` | Busca global |
| `SearchResultsList.tsx` | Resultados da busca |
| `QuickTemplatesPopover.tsx` | Seletor rapido de templates |
| `QuickTemplatesConfigModal.tsx` | Config de atalhos de template |
| `ScheduleMessageModal.tsx` | Modal de agendamento |
| `TransferModal.tsx` | Modal de transferencia |
| `ShareModal.tsx` | Modal de compartilhamento |
| `ImagePreviewDialog.tsx` | Viewer de imagens (zoom/pan) |
| `DocumentPreview.tsx` | Preview de documentos |
| `DocumentPreviewDialog.tsx` | Modal de preview de doc |
| `MediaDownloadButton.tsx` | Botao de download |
| `StartConversation.tsx` | Iniciar nova conversa |
| `ConversationPreviewDialog.tsx` | Preview rapido |
| `OrderSelectionModal.tsx` | Selecao de pedido |
| `QuoteSelectionModal.tsx` | Selecao de orcamento |
| `OrderDetailsInlineModal.tsx` | Detalhes do pedido inline |
| `QuoteDetailsInlineModal.tsx` | Detalhes do orcamento inline |
| `BulkActionsBar.tsx` | Barra de acoes em massa |
| `BulkCloseModal.tsx` | Modal fechar em massa |
| `BulkTransferModal.tsx` | Modal transferir em massa |
| `BulkLeadStatusModal.tsx` | Modal lead status em massa |
| `BulkTagModal.tsx` | Modal tag em massa |
| `TransferEventCard.tsx` | Card evento transferencia |
| `ReopenEventCard.tsx` | Card evento reabertura |
| `CloseEventCard.tsx` | Card evento fechamento |
| `ShareEventCard.tsx` | Card evento compartilhamento |
| `ShareCancelledEventCard.tsx` | Card share cancelado |
| `WaitingCard.tsx` | Card conversa em espera |
| `QuotePendingAlert.tsx` | Alerta orcamento pendente |
| `PaymentLinkModal.tsx` | Modal link de pagamento |
| `ContactRequestModal.tsx` | Modal solicitar contato |
| `CallLogModal.tsx` | Modal registrar ligacao |
| `MobileSwipeNavigation.tsx` | Navegacao swipe mobile |

### Quick Messages (`src/components/quick-messages/`)
| Componente | Descricao |
|------------|-----------|
| `AudioRecorder.tsx` | Gravacao de audio completa |
| `CompactAudioRecorder.tsx` | Gravacao compacta |
| `FileUploader.tsx` | Upload de arquivos |
| `EmojiPickerButton.tsx` | Picker de emojis |

### Chat Interno (`src/components/internal-chat/`)
| Componente | Descricao |
|------------|-----------|
| `InternalChatSidebar.tsx` | Lista de threads |
| `InternalChatArea.tsx` | Area de mensagens |
| `InternalChatHeader.tsx` | Cabecalho |
| `InternalChatInput.tsx` | Input de mensagem |
| `InternalChatMessageItem.tsx` | Item de mensagem |

---

## 10. Hooks (Inventario Completo)

### Conversas
| Hook | Descricao |
|------|-----------|
| `useConversations` | Busca conversas ativas |
| `usePaginatedConversations` | Paginacao infinita com filtros |
| `useMessages` | Mensagens de uma conversa |
| `usePaginatedMessages` | Mensagens com paginacao cursor |
| `useSendMessage` | Enviar mensagem (optimistic) |
| `useDeleteMessage` | Excluir mensagem |
| `useEditMessage` | Editar mensagem |
| `useReactToMessage` | Reagir com emoji |
| `useUpdateConversation` | Atualizar conversa |
| `useConversationEvents` | Eventos da conversa |
| `useTransferConversation` | Transferir conversa |
| `useReturnConversation` | Retornar ao agente original |
| `useShareConversation` | Compartilhar conversa |
| `useRealtimeMessages` | Realtime mensagens |
| `useRealtimeConversations` | Realtime lista de conversas |
| `useRealtimeConversationEvents` | Realtime eventos |
| `useRealtimeConversationDetails` | Realtime sidebar |
| `useTypingIndicator` | Indicador de digitacao |
| `useConversationCounts` | Contadores com filtros |
| `useMyWaitingConversations` | Conversas aguardando |
| `useInternalNotes` | Notas internas CRUD |
| `useGlobalSearch` | Busca global |
| `useBulkConversationActions` | Acoes em massa |
| `use24hWindow` | Janela 24h WhatsApp |

### Templates
| Hook | Descricao |
|------|-----------|
| `useTemplates` | CRUD templates |
| `useTemplateFolders` | Pastas de templates |
| `useUserQuickTemplates` | Atalhos de template |
| `useApprovedMetaTemplates` | Templates Meta |

### Canais
| Hook | Descricao |
|------|-----------|
| `useChannels` | Canais ativos |
| `useDeletedChannels` | Canais excluidos |

### Chat Interno
| Hook | Descricao |
|------|-----------|
| `useInternalChatThreads` | Threads de chat |
| `useInternalChatMessages` | Mensagens do thread |
| `useSendInternalMessage` | Enviar mensagem interna |
| `useInternalChatRealtime` | Realtime chat interno |

### Outros
| Hook | Descricao |
|------|-----------|
| `useSatisfactionConfig` | Config pesquisa satisfacao |
| `useNotificationSettings` | Config notificacoes |
| `usePendingCallbacks` | Lembretes pendentes |

---

*Documento gerado automaticamente a partir da analise do codebase em 23/02/2026.*
