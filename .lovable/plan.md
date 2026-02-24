

# Reconfigurar Webhooks Automaticamente para ACK (✓✓)

## Problema
Alguns canais UAZAPI foram configurados antes de o evento `messagesUpdate: true` ser adicionado. Por isso, esses canais nao recebem os eventos de "entregue" e "lido", ficando sempre com apenas um tracinho (✓).

## Solucao
Criar um mecanismo automatico que reconfigura os webhooks de todos os canais UAZAPI/Evolution ativos **sem necessidade de botoes ou interacao manual**. Isso sera feito de duas formas complementares:

### 1. Reconfigurar na inicializacao (webhook recebido)
Quando o `whatsapp-webhook` receber uma mensagem de um canal, verificar se o webhook desse canal ja foi reconfigurado. Se nao, disparar a reconfiguracao automaticamente em background (sem bloquear o processamento da mensagem).

- Usar um campo `webhook_events_configured_at` na tabela `whatsapp_channels` para rastrear se a reconfiguracao ja foi feita
- Se o campo for `null`, chamar a action `reconfigureWebhook` em background e marcar o timestamp
- Isso garante que cada canal sera reconfigurado **uma unica vez**, na proxima mensagem recebida

### 2. Reconfigurar todos os canais existentes de uma vez (migracao)
Criar uma Edge Function `reconfigure-all-webhooks` que:
- Busca todos os canais UAZAPI e Evolution ativos
- Chama a action `reconfigureWebhook` para cada um
- Atualiza o campo `webhook_events_configured_at`
- Sera executada uma unica vez para corrigir os canais existentes

---

## Detalhes Tecnicos

### Migracao SQL
```sql
ALTER TABLE whatsapp_channels 
ADD COLUMN IF NOT EXISTS webhook_events_configured_at timestamptz DEFAULT NULL;
```

### Edge Function: `reconfigure-all-webhooks`
- Busca todos os canais com `is_deleted = false` e `webhook_events_configured_at IS NULL`
- Para cada canal UAZAPI/Evolution, chama `whatsapp-instance` com action `reconfigureWebhook`
- Atualiza o campo `webhook_events_configured_at` com `now()`
- Retorna relatorio de quantos canais foram reconfigurados com sucesso/erro

### Modificacao no `whatsapp-webhook`
- Apos identificar o canal, verificar se `webhook_events_configured_at` e `null`
- Se sim, disparar `supabase.functions.invoke('whatsapp-instance', { body: { action: 'reconfigureWebhook', channelId } })` sem await (fire-and-forget)
- Atualizar o campo para evitar reconfiguracao repetida

### Fluxo
```text
Canal recebe mensagem
       |
webhook_events_configured_at = null?
       |
   SIM: dispara reconfigureWebhook (background)
         -> configura messagesUpdate: true
         -> atualiza webhook_events_configured_at
       |
   NAO: segue normalmente
```

### Resultado
- Todos os canais existentes serao corrigidos ao executar `reconfigure-all-webhooks` uma vez
- Canais futuros que por algum motivo nao tenham a config correta serao auto-corrigidos na primeira mensagem
- Zero impacto na experiencia do usuario, sem botoes, sem telas extras
- O CRM nao e comprometido pois a reconfiguracao roda em background

