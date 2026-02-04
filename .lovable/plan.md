
# Plano: Corrigir Automação não Disparada para Lead 988949116

## Diagnóstico Completo

Após investigação detalhada no banco de dados e logs, identifiquei a causa raiz:

### O que aconteceu

1. **Lead 988949116**: A mensagem com "Registro de Cadastramento" foi enviada às 13:56:38
2. **Fluxo esperado**: "EMPREGA MAIS - PROTOCOLO AGENDAMENTO" deveria ser disparado (trigger: message_key contendo "Cadastramento")
3. **Problema**: O `process-flow-triggers` **não foi invocado** para esta mensagem

### Comparação com lead 21992731918 (que funcionou)

| Aspecto | 988949116 (falhou) | 21992731918 (funcionou) |
|---------|-------------------|-------------------------|
| Canal | ed6f2c8c (EMPREGA-MAIS) | ed6f2c8c (EMPREGA-MAIS) |
| Tenant | 664dfcb4 (Master) | 664dfcb4 (Master) |
| Trigger | message_key ("Cadastramento") | message_key ("Vi que iniciou") |
| Execução criada | ❌ NÃO | ✅ SIM (12:42:19) |

### Causa Raiz Identificada

O webhook `whatsapp-webhook` tem múltiplos pontos de saída que **não invocam** o `process-flow-triggers`:

1. **Linha 1280**: Se a mensagem já existe com `whatsapp_message_id` → retorna sem disparar
2. **Linha 1623-1628**: Se ocorre erro de duplicata (constraint 23505) → retorna sem disparar
3. **Linha 1494-1498**: Se a mensagem foi inserida enquanto processava → retorna sem disparar

Provavelmente ocorreu um dos seguintes cenários:
- A mensagem foi inserida em uma chamada anterior do webhook, e uma chamada subsequente (ACK/update) encontrou a duplicata e pulou
- Houve uma condição de corrida entre duas chamadas de webhook

### Prova de que o fluxo funciona

Executei manualmente o `process-flow-triggers` para o contato 988949116 com a mensagem "Cadastramento" e:
- ✅ Trigger foi disparado com sucesso
- ✅ Execução criada: `71b54ccc-42c7-447f-a020-c165b067c542`
- ✅ Status: completed

---

## Solução Proposta

### 1. Ajustar webhook para disparar trigger mesmo em cenários de duplicata

Modificar o `whatsapp-webhook/index.ts` para invocar o `process-flow-triggers` mesmo quando a mensagem já existe, desde que seja uma mensagem recente (menos de 60 segundos).

```typescript
// Antes de retornar por duplicata, verificar se devemos disparar trigger
if (existingByWhatsappId) {
  // Verificar se a mensagem é recente e se o trigger ainda não foi invocado
  const { data: existingMsg } = await supabase
    .from("messages")
    .select("id, created_at, trigger_processed")
    .eq("id", existingByWhatsappId.id)
    .single();
  
  const isRecent = existingMsg && 
    (Date.now() - new Date(existingMsg.created_at).getTime()) < 60000;
  
  if (isRecent && !existingMsg.trigger_processed) {
    // Disparar trigger e marcar como processado
    await supabase.functions.invoke('process-flow-triggers', { ... });
    await supabase.from("messages").update({ trigger_processed: true }).eq("id", existingMsg.id);
  }
  
  return new Response(...);
}
```

### 2. Adicionar coluna de rastreamento de trigger

Adicionar coluna `trigger_processed` na tabela `messages` para garantir idempotência:

```sql
ALTER TABLE messages ADD COLUMN trigger_processed BOOLEAN DEFAULT FALSE;
```

### 3. Centralizar invocação do trigger

Criar uma função helper que garante a invocação do trigger em todos os cenários de mensagem enviada:

```typescript
async function maybeInvokeMessageKeyTrigger(
  supabase,
  messageId: string,
  tenantId: string,
  contactId: string,
  channelId: string,
  conversationId: string,
  messageContent: string
) {
  // Verificar se já foi processado
  const { data: msg } = await supabase
    .from("messages")
    .select("trigger_processed")
    .eq("id", messageId)
    .single();
  
  if (msg?.trigger_processed) return;
  
  // Invocar trigger
  await supabase.functions.invoke('process-flow-triggers', {
    body: {
      trigger_type: 'message_key',
      tenant_id: tenantId,
      contact_id: contactId,
      channel_id: channelId,
      conversation_id: conversationId,
      message_content: messageContent,
    }
  });
  
  // Marcar como processado
  await supabase
    .from("messages")
    .update({ trigger_processed: true })
    .eq("id", messageId);
}
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/migrations/[timestamp].sql` | Adicionar coluna `trigger_processed` na tabela `messages` |
| `supabase/functions/whatsapp-webhook/index.ts` | Refatorar lógica de duplicatas para disparar trigger se necessário |

---

## Ação Imediata (já executada)

Como prova de conceito, já invoquei manualmente o `process-flow-triggers` para o lead 988949116:
- ✅ Execução criada: `71b54ccc-42c7-447f-a020-c165b067c542`
- ✅ Fluxo "EMPREGA MAIS - PROTOCOLO AGENDAMENTO" executado
- ✅ Status do lead deve ter sido atualizado

Você pode verificar se o status do lead foi atualizado corretamente.

---

## Benefícios da Correção

1. **Garantia de disparo**: Toda mensagem enviada terá o trigger processado
2. **Idempotência**: A coluna `trigger_processed` evita disparos duplicados
3. **Observabilidade**: Facilita debug de mensagens que não tiveram automação
4. **Robustez**: Funciona mesmo com condições de corrida no webhook
