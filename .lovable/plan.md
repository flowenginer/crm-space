

# Plano de Correção: Importação de Contatos e Erro phone_number

## Problemas Identificados

### Problema 1: Erro "column whatsapp_channels.phone_number does not exist"

Os logs do Postgres mostram esse erro repetidamente. A causa é que várias partes do código usam `phone_number` quando a coluna correta é `phone`.

**Arquivos afetados:**
| Arquivo | Linha | Query Incorreta |
|---------|-------|-----------------|
| `supabase/functions/api-send-message/index.ts` | 492 | `.select('id, name, phone_number')` |
| `supabase/functions/cloudapi-webhook/index.ts` | 680 | `.select('id, name, phone_number')` |
| `supabase/functions/cloudapi-send-message/index.ts` | 424 | `.select('id, name, phone_number')` |
| `src/components/settings/CloudAPICallingSettings.tsx` | 46 | `phone_number` em join |
| `src/components/webhooks/RestApiDocs.tsx` | 345, 383 | Documentação com nome errado |

### Problema 2: Atendente não está sendo atribuído

Analisando o fluxo, identifiquei que quando você seleciona um "Vendedor Padrão" no dropdown, o código atribui corretamente ao `defaultAssigneeId`. Porém:

1. **Checkbox não marcado**: A atribuição de vendedor só funciona se a opção "Atualizar vendedor atribuído" estiver marcada
2. **Contatos existentes sem conversa**: Para contatos existentes, o `assigned_to` é atualizado no contact, mas se não houver conversa aberta, o assigned_to não aparece na tela de conversas

### Problema 3: Importação travando em 60%

O progresso 60% corresponde à **Fase 4: Batch Update de Contatos Existentes** (linha 451-487). O código faz updates **sequenciais** (um por um), o que é muito lento para listas grandes:

```typescript
// PROBLEMA: Update individual para cada contato
for (const update of contactsToUpdate) {
  await supabase.from('contacts').update(update.data).eq('id', update.id);
}
```

Para 1629 contatos, isso pode significar 1629+ queries sequenciais, causando timeout ou lentidão extrema.

---

## Solução Proposta

### Correção 1: Trocar phone_number para phone nas Edge Functions

Corrigir todas as referências incorretas de `phone_number` para `phone`:

```typescript
// ANTES (errado):
.select('id, name, phone_number')

// DEPOIS (correto):
.select('id, name, phone')
```

### Correção 2: Otimizar Updates em Batch

Em vez de updates sequenciais, agrupar por dados iguais e fazer updates em lote:

```typescript
// Agrupar contatos por dados de atualização
const updateGroups = new Map<string, string[]>();

for (const update of contactsToUpdate) {
  const key = JSON.stringify(update.data);
  if (!updateGroups.has(key)) {
    updateGroups.set(key, []);
  }
  updateGroups.get(key)!.push(update.id);
}

// Fazer um update por grupo
for (const [dataKey, ids] of updateGroups) {
  const data = JSON.parse(dataKey);
  await supabase
    .from('contacts')
    .update(data)
    .in('id', ids);
}
```

**Ganho esperado**: De ~1600 queries para ~10-50 queries (agrupando por mesmo assigned_to/lead_status).

### Correção 3: Criar conversas para contatos sem conversa

Quando um vendedor padrão é selecionado E um canal é selecionado, garantir que conversas sejam criadas para todos os contatos, não apenas os novos:

```typescript
// Após atribuir vendedor a contatos existentes, 
// também criar/atualizar conversas se canal foi selecionado
if (options.channelId && options.defaultAssigneeId) {
  // Para cada contato atualizado, verificar se tem conversa no canal
  // Se não tiver, criar; se tiver, atualizar assigned_to
}
```

---

## Arquivos a Modificar

| Arquivo | Tipo | Alteração |
|---------|------|-----------|
| `supabase/functions/api-send-message/index.ts` | Modificar | Trocar `phone_number` → `phone` (linha 492) |
| `supabase/functions/cloudapi-webhook/index.ts` | Modificar | Trocar `phone_number` → `phone` (linha 680) |
| `supabase/functions/cloudapi-send-message/index.ts` | Modificar | Trocar `phone_number` → `phone` (linha 424) |
| `src/components/settings/CloudAPICallingSettings.tsx` | Modificar | Trocar `phone_number` → `phone` (linha 46) |
| `src/components/webhooks/RestApiDocs.tsx` | Modificar | Corrigir documentação |
| `src/hooks/useImportContacts.ts` | Modificar | Otimizar batch updates + criar conversas para contatos existentes |

---

## Resultado Esperado

1. **Erro phone_number eliminado**: Os erros contínuos nos logs desaparecerão
2. **Atribuição funcional**: O vendedor será corretamente atribuído tanto em contacts quanto em conversations
3. **Performance**: Importação de 1600+ contatos deve cair de 10+ minutos para menos de 1 minuto

