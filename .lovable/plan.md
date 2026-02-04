
# Plano: Corrigir Webhook para n8n - tenant_id não está sendo passado

## Diagnóstico Confirmado

### O que está acontecendo

Os logs mostram repetidamente:
```
ERROR [dispatch-webhook] Error creating delivery: {
  code: "P0001",
  message: "tenant_id é obrigatório e não foi possível determinar automaticamente"
}
```

### Por que está falhando

1. A tabela `webhook_deliveries` requer `tenant_id` obrigatório (`NOT NULL`)
2. Existe um trigger `set_tenant_id_from_user()` que tenta preencher automaticamente
3. A Edge Function usa `service_role` (sem usuário autenticado)
4. O código **não está passando** o `tenant_id` na inserção

### Código problemático (linha 103-112)

```typescript
const { data: delivery, error: deliveryError } = await supabase
  .from('webhook_deliveries')
  .insert({
    webhook_id: webhook.id,
    event_type: event.type,
    payload,
    status: 'pending',
    // ❌ tenant_id AUSENTE!
  })
```

O `tenant_id` existe em duas fontes possíveis:
1. `event.context.tenant_id` - passado pelo caller
2. `webhook.tenant_id` - do próprio webhook config (como fallback)

---

## Solução

### Modificação na Edge Function `dispatch-webhook/index.ts`

Adicionar `tenant_id` na inserção do delivery, obtendo de uma das duas fontes:

```typescript
// Determinar tenant_id
const tenantId = (event.context as any)?.tenant_id || webhook.tenant_id;

const { data: delivery, error: deliveryError } = await supabase
  .from('webhook_deliveries')
  .insert({
    webhook_id: webhook.id,
    event_type: event.type,
    payload,
    status: 'pending',
    tenant_id: tenantId, // ✅ CORRIGIDO!
  })
```

### Também adicionar tipagem para WebhookConfig

Adicionar `tenant_id` à interface para evitar erros TypeScript:

```typescript
interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  auth_type: string;
  auth_token: string | null;
  auth_header_name: string | null;
  auth_header_value: string | null;
  events: string[];
  filters: Record<string, string>;
  is_active: boolean;
  tenant_id: string; // ✅ ADICIONAR
}
```

---

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/dispatch-webhook/index.ts` | Adicionar `tenant_id` na inserção e na interface |

---

## Resultado Esperado

Após a correção:
1. Webhooks para `message.received` serão enviados corretamente ao n8n
2. Os registros de delivery serão criados em `webhook_deliveries`
3. A comunicação com a IA voltará a funcionar normalmente
