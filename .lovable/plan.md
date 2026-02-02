
# Auditoria: Tabelas Sem Triggers de Tenant Isolation

## Resumo da Investigação

Identifiquei **30 tabelas** que têm coluna `tenant_id` mas **NÃO possuem trigger** para preenchimento automático. Dessas, **8 tabelas têm o placeholder problemático** que causa erros de RLS (igual ao problema de `contact_tags`).

---

## Classificação das Tabelas por Risco

### CRÍTICO - Placeholder Fixo (Erro RLS garantido)

Estas tabelas vão **falhar com erro de RLS** para novos tenants, igual ao `contact_tags`:

| Tabela | Funcionalidade | Impacto |
|--------|---------------|---------|
| `satisfaction_config` | Configuração de pesquisa de satisfação | Admin não consegue configurar |
| `satisfaction_surveys` | Respostas de pesquisa | Pesquisas não são salvas |
| `conversation_analysis` | Análise de IA de conversas | Análises falham silenciosamente |
| `bling_integration_config` | Config do Bling ERP | Integração não funciona |
| `bling_id_mappings` | Mapeamento Bling | Sync falha |
| `bling_sync_logs` | Logs do Bling | Logs não salvos |
| `meta_sync_logs` | Logs sync Meta Ads | Logs não salvos |
| `redirect_campaign_channels` | Canais de campanha redirect | Campanhas falham |
| `redirect_logs` | Logs de redirect | Analytics falham |

### ALTO - Sem Default (Erro NULL ou RLS)

Tabelas que vão falhar por `tenant_id = NULL` ou violação de NOT NULL:

| Tabela | Funcionalidade | Impacto |
|--------|---------------|---------|
| `support_tickets` | Sistema de suporte | Tickets não são criados |
| `sales_evaluations` | Avaliações de vendas | Avaliações falham |
| `sales_evaluation_targets` | Metas de avaliação | Metas não salvam |
| `cloudapi_configs` | Config CloudAPI | Integração falha |
| `integration_api_keys` | Chaves de API | Integrações falham |
| `redirect_campaigns` | Campanhas de redirect | Campanhas não criam |
| `redirect_ab_tests` | Testes A/B | Testes não criam |
| `redirect_ab_test_variants` | Variantes de teste | Variantes não salvam |
| `whatsapp_channel_events` | Eventos de canal | Eventos não salvos |
| `template_pricing` | Preços de template | Config falha |
| `meta_message_templates` | Templates Meta | Templates falham |
| `marketing_action_logs` | Logs de marketing | Logs não salvos |

### OK - Default via JWT (Funcionando)

Estas tabelas usam `current_setting('request.jwt.claims')` como default, que funciona corretamente:

- `active_marketing_campaigns`
- `marketing_campaigns`  
- `marketing_scheduled_messages`

### BAIXO - Logs/OAuth (Menos crítico)

Tabelas de log ou OAuth que podem funcionar parcialmente:

- `cloudapi_webhook_logs` (nullable)
- `meta_oauth_states` (nullable)
- `rede_oauth_tokens` (nullable)
- `redirect_campaign_pageviews` (nullable)
- `redirect_campaign_views` (nullable)
- `bling_status_mappings` (sem default)

---

## Plano de Correção

### Migração SQL

Criar triggers para **21 tabelas críticas** usando a função existente `set_tenant_id_from_user()`:

```sql
-- 1. TABELAS COM PLACEHOLDER (remover default + criar trigger)
-- satisfaction_config
ALTER TABLE satisfaction_config ALTER COLUMN tenant_id DROP DEFAULT;
CREATE TRIGGER trigger_set_tenant_id_satisfaction_config
BEFORE INSERT ON satisfaction_config
FOR EACH ROW EXECUTE FUNCTION set_tenant_id_from_user();

-- satisfaction_surveys
ALTER TABLE satisfaction_surveys ALTER COLUMN tenant_id DROP DEFAULT;
CREATE TRIGGER trigger_set_tenant_id_satisfaction_surveys
BEFORE INSERT ON satisfaction_surveys
FOR EACH ROW EXECUTE FUNCTION set_tenant_id_from_user();

-- conversation_analysis
ALTER TABLE conversation_analysis ALTER COLUMN tenant_id DROP DEFAULT;
CREATE TRIGGER trigger_set_tenant_id_conversation_analysis
BEFORE INSERT ON conversation_analysis
FOR EACH ROW EXECUTE FUNCTION set_tenant_id_from_user();

-- bling_integration_config
ALTER TABLE bling_integration_config ALTER COLUMN tenant_id DROP DEFAULT;
CREATE TRIGGER trigger_set_tenant_id_bling_integration_config
BEFORE INSERT ON bling_integration_config
FOR EACH ROW EXECUTE FUNCTION set_tenant_id_from_user();

-- bling_id_mappings
ALTER TABLE bling_id_mappings ALTER COLUMN tenant_id DROP DEFAULT;
CREATE TRIGGER trigger_set_tenant_id_bling_id_mappings
BEFORE INSERT ON bling_id_mappings
FOR EACH ROW EXECUTE FUNCTION set_tenant_id_from_user();

-- bling_sync_logs
ALTER TABLE bling_sync_logs ALTER COLUMN tenant_id DROP DEFAULT;
CREATE TRIGGER trigger_set_tenant_id_bling_sync_logs
BEFORE INSERT ON bling_sync_logs
FOR EACH ROW EXECUTE FUNCTION set_tenant_id_from_user();

-- meta_sync_logs
ALTER TABLE meta_sync_logs ALTER COLUMN tenant_id DROP DEFAULT;
CREATE TRIGGER trigger_set_tenant_id_meta_sync_logs
BEFORE INSERT ON meta_sync_logs
FOR EACH ROW EXECUTE FUNCTION set_tenant_id_from_user();

-- redirect_campaign_channels
ALTER TABLE redirect_campaign_channels ALTER COLUMN tenant_id DROP DEFAULT;
CREATE TRIGGER trigger_set_tenant_id_redirect_campaign_channels
BEFORE INSERT ON redirect_campaign_channels
FOR EACH ROW EXECUTE FUNCTION set_tenant_id_from_user();

-- redirect_logs
ALTER TABLE redirect_logs ALTER COLUMN tenant_id DROP DEFAULT;
CREATE TRIGGER trigger_set_tenant_id_redirect_logs
BEFORE INSERT ON redirect_logs
FOR EACH ROW EXECUTE FUNCTION set_tenant_id_from_user();

-- 2. TABELAS SEM DEFAULT (apenas criar trigger)
-- support_tickets
CREATE TRIGGER trigger_set_tenant_id_support_tickets
BEFORE INSERT ON support_tickets
FOR EACH ROW EXECUTE FUNCTION set_tenant_id_from_user();

-- sales_evaluations
CREATE TRIGGER trigger_set_tenant_id_sales_evaluations
BEFORE INSERT ON sales_evaluations
FOR EACH ROW EXECUTE FUNCTION set_tenant_id_from_user();

-- sales_evaluation_targets
CREATE TRIGGER trigger_set_tenant_id_sales_evaluation_targets
BEFORE INSERT ON sales_evaluation_targets
FOR EACH ROW EXECUTE FUNCTION set_tenant_id_from_user();

-- cloudapi_configs
CREATE TRIGGER trigger_set_tenant_id_cloudapi_configs
BEFORE INSERT ON cloudapi_configs
FOR EACH ROW EXECUTE FUNCTION set_tenant_id_from_user();

-- integration_api_keys
CREATE TRIGGER trigger_set_tenant_id_integration_api_keys
BEFORE INSERT ON integration_api_keys
FOR EACH ROW EXECUTE FUNCTION set_tenant_id_from_user();

-- redirect_campaigns
CREATE TRIGGER trigger_set_tenant_id_redirect_campaigns
BEFORE INSERT ON redirect_campaigns
FOR EACH ROW EXECUTE FUNCTION set_tenant_id_from_user();

-- redirect_ab_tests
CREATE TRIGGER trigger_set_tenant_id_redirect_ab_tests
BEFORE INSERT ON redirect_ab_tests
FOR EACH ROW EXECUTE FUNCTION set_tenant_id_from_user();

-- redirect_ab_test_variants
CREATE TRIGGER trigger_set_tenant_id_redirect_ab_test_variants
BEFORE INSERT ON redirect_ab_test_variants
FOR EACH ROW EXECUTE FUNCTION set_tenant_id_from_user();

-- whatsapp_channel_events
CREATE TRIGGER trigger_set_tenant_id_whatsapp_channel_events
BEFORE INSERT ON whatsapp_channel_events
FOR EACH ROW EXECUTE FUNCTION set_tenant_id_from_user();

-- template_pricing
CREATE TRIGGER trigger_set_tenant_id_template_pricing
BEFORE INSERT ON template_pricing
FOR EACH ROW EXECUTE FUNCTION set_tenant_id_from_user();

-- meta_message_templates
CREATE TRIGGER trigger_set_tenant_id_meta_message_templates
BEFORE INSERT ON meta_message_templates
FOR EACH ROW EXECUTE FUNCTION set_tenant_id_from_user();

-- marketing_action_logs
CREATE TRIGGER trigger_set_tenant_id_marketing_action_logs
BEFORE INSERT ON marketing_action_logs
FOR EACH ROW EXECUTE FUNCTION set_tenant_id_from_user();
```

---

## Resultado Esperado

Após a migração:
- Novos tenants poderão usar **todas as funcionalidades** sem erros de RLS
- O `tenant_id` será preenchido automaticamente em todas as tabelas
- Erros de isolamento multi-tenant serão prevenidos

---

## Prioridade Recomendada

1. **Imediato**: `satisfaction_config`, `satisfaction_surveys`, `support_tickets` (funcionalidades ativas)
2. **Alta**: `sales_evaluations`, `cloudapi_configs`, `integration_api_keys` (integrações)
3. **Média**: Tabelas de Bling, redirect, Meta (módulos específicos)
