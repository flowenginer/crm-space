
# Plano: Corrigir Agendamento de Mensagens para Usuários da Master

## Diagnóstico do Problema

Os logs do Supabase mostram claramente o erro:

```
new row violates row-level security policy "Tenant isolation for scheduled_messages" 
for table "scheduled_messages"
```

### Causa Raiz

A tabela `scheduled_messages` tem um **DEFAULT incorreto** para `tenant_id`:

| Configuração | Valor |
|--------------|-------|
| `tenant_id` DEFAULT | `'00000000-0000-0000-0000-000000000001'` (Space Sports) |
| Tenant da Master | `'664dfcb4-5432-4c14-9838-7db14360cabf'` |

### Fluxo do Erro

1. Usuário da Master (tenant `664d...cabf`) tenta agendar mensagem
2. O código NÃO envia `tenant_id` no INSERT
3. O banco usa o DEFAULT: `'00000000-0000-0000-0000-000000000001'`
4. Política RLS verifica: `tenant_id = get_user_tenant_id()`
5. Comparação: `'00000000...' = '664d...'` → **FALSE** → Bloqueado

---

## Solução

### Opção 1 (Recomendada): Alterar o DEFAULT da coluna

Trocar o DEFAULT fixo por uma função que retorna o tenant_id do usuário autenticado:

```sql
ALTER TABLE scheduled_messages 
ALTER COLUMN tenant_id 
SET DEFAULT get_user_tenant_id();
```

### Opção 2 (Alternativa): Enviar tenant_id explicitamente no código

Modificar o `ScheduleMessageModal.tsx` para buscar e enviar o `tenant_id` do usuário:

```typescript
// Buscar tenant_id do usuário
const { data: profile } = await supabase
  .from('profiles')
  .select('tenant_id')
  .eq('id', user?.id)
  .single();

// Incluir no INSERT
const { error } = await supabase
  .from('scheduled_messages')
  .insert({
    contact_id: contactId,
    conversation_id: conversationId,
    channel_id: finalChannelId,
    content: finalMessage || '',
    media_url: mediaUrl,
    message_type: messageType,
    scheduled_for: scheduledFor.toISOString(),
    status: 'scheduled',
    created_by: user?.id,
    tenant_id: profile?.tenant_id  // ← ADICIONAR ISSO
  });
```

---

## Recomendação

**Usar ambas as soluções** para garantir robustez:

1. **Alterar o DEFAULT** no banco (para casos onde o frontend não envia)
2. **Enviar tenant_id explicitamente** no código (mais explícito e previsível)

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| Migração SQL | Alterar DEFAULT de `tenant_id` |
| `src/components/conversations/ScheduleMessageModal.tsx` | Incluir `tenant_id` no INSERT |

---

## Seção Técnica

### Por que o DEFAULT está errado?

O tenant `00000000-0000-0000-0000-000000000001` (Space Sports) foi provavelmente usado como valor de desenvolvimento. Para sistemas multi-tenant, o correto é:

```sql
tenant_id uuid DEFAULT get_user_tenant_id()
```

### Política RLS Atual

```sql
-- Política RESTRICTIVE (mais restritiva, combina com AND)
CREATE POLICY "Tenant isolation for scheduled_messages" 
ON scheduled_messages AS RESTRICTIVE
FOR ALL TO authenticated
USING (tenant_id = get_user_tenant_id())
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));
```

O `WITH CHECK` permite `tenant_id IS NULL` ou igual ao do usuário, mas como tem DEFAULT, nunca é NULL.
