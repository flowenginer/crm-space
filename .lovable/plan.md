
# Plano: Corrigir Distribuição na Automação de Transferência para Departamento

## Problema Identificado

Quando a automação "Transferir Departamento" é executada:
1. O código apenas atualiza `conversations.department_id` e limpa `assigned_to = null`
2. **NÃO chama** a função `distribute-lead` para atribuir o lead ao próximo agente
3. Resultado: O contato fica no departamento correto, mas sem atendente atual nem responsável

### Código Atual (Problemático)
```typescript
// supabase/functions/execute-flow-node/index.ts - Linha 734-745
case 'transfer_department':
  await supabase
    .from('conversations')
    .update({
      department_id: config.department_id,
      assigned_to: null  // ❌ Limpa o atendente e não redistribui
    })
    .eq('id', execution.conversation_id);
```

### Dados do Problema
**948 contatos** têm atendente responsável definido mas suas conversas não têm atendente atual.

---

## Solução Proposta

### 1. Modificar a Ação `transfer_department` para Chamar Distribuição

Após atualizar o departamento da conversa, verificar se o departamento destino tem distribuição de leads configurada e, se sim, chamar a função `distribute-lead`.

**Arquivos a modificar:**
- `supabase/functions/execute-flow-node/index.ts` (Edge Function - backend)
- `src/lib/flow-engine/index.ts` (Frontend flow engine - para pré-visualização)

### 2. Lógica da Correção

```typescript
case 'transfer_department':
  if (config.department_id && execution.conversation_id) {
    // 1. Buscar contact_id da conversa
    const { data: conv } = await supabase
      .from('conversations')
      .select('contact_id')
      .eq('id', execution.conversation_id)
      .single();
    
    // 2. Atualizar departamento da conversa (sem limpar assigned_to ainda)
    await supabase
      .from('conversations')
      .update({
        department_id: config.department_id,
        assigned_to: null
      })
      .eq('id', execution.conversation_id);
    
    // 3. Atualizar departamento do contato
    if (conv?.contact_id) {
      await supabase
        .from('contacts')
        .update({
          department_id: config.department_id
        })
        .eq('id', conv.contact_id);
    }
    
    // 4. Chamar distribuição de leads se configurada para este departamento
    if (conv?.contact_id) {
      try {
        const baseUrl = Deno.env.get('SUPABASE_URL') || '';
        await fetch(`${baseUrl}/functions/v1/distribute-lead`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contact_id: conv.contact_id,
            force_department_id: config.department_id
          })
        });
      } catch (e) {
        console.log('[execute-flow-node] Distribution call failed, lead will remain unassigned');
      }
    }
    
    await logExecution(supabase, execution.id, node.id, 'info', 'Transferido para departamento');
  }
  break;
```

### 3. Modificar `distribute-lead` para Aceitar `force_department_id`

A função `distribute-lead` precisa ser atualizada para aceitar um parâmetro opcional `force_department_id` que sobrescreve o departamento configurado nas settings.

**Arquivo:** `supabase/functions/distribute-lead/index.ts`

```typescript
// Aceitar force_department_id no body
const { contact_id, force_department_id } = await req.json();

// Usar force_department_id se fornecido, senão usar da configuração
const targetDepartmentId = force_department_id || settings?.lead_distribution_department_id;
```

---

## Correção dos 948 Contatos Existentes

Criar um script SQL para sincronizar os atendentes:

```sql
-- Script para atribuir atendente atual baseado no responsável do contato
UPDATE conversations cv
SET assigned_to = con.assigned_to
FROM contacts con
WHERE cv.contact_id = con.id
  AND cv.status IN ('open', 'pending')
  AND cv.assigned_to IS NULL
  AND con.assigned_to IS NOT NULL;
```

Esse script atribui o "atendente atual" da conversa ao mesmo "atendente responsável" do contato para todas as 948 conversas órfãs.

---

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/execute-flow-node/index.ts` | Adicionar chamada à `distribute-lead` após `transfer_department` |
| `src/lib/flow-engine/index.ts` | Espelhar a mesma lógica no frontend |
| `supabase/functions/distribute-lead/index.ts` | Aceitar parâmetro `force_department_id` |
| Script SQL (manual) | Sincronizar 948 conversas órfãs |

---

## Fluxo Corrigido

```text
Automação: "Transferir Departamento"
   ↓
1. Atualizar conversations.department_id
   ↓
2. Atualizar contacts.department_id
   ↓
3. Chamar distribute-lead com force_department_id
   ↓
4. distribute-lead atribui:
   ├── contacts.assigned_to (Atendente Responsável)
   └── conversations.assigned_to (Atendente Atual)
   ↓
5. Ambos os campos preenchidos ✓
```

---

## Resultado Esperado

- **Transferências via automação**: Atribuirão tanto atendente atual quanto responsável
- **948 contatos existentes**: Serão corrigidos via script SQL
- **Compatibilidade**: A função `distribute-lead` continua funcionando normalmente para chamadas sem `force_department_id`
