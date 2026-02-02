
# Plano de Correção: Importação de Contatos

## 📋 Resumo do Problema

A importação de 4.304 leads resultou em:
- **3.568 contatos SEM atribuição de agente** (88%)
- **0 tags associadas** aos contatos (embora as tags tenham sido criadas)
- Status de lead funcionando parcialmente

## 🔍 Causa Raiz

Foram identificados **3 bugs críticos** no `useImportContacts.ts`:

### Bug #1: Vendedor Ignorado para Novos Contatos
**Localização:** Linhas 431-436

Ao criar novos contatos, o código usa apenas `defaultAssigneeId` (vendedor fixo da interface). O vendedor mapeado da coluna da planilha (`Agente` = "Susana", "Bruna", etc.) é completamente ignorado para contatos que não existem no sistema.

```typescript
// CÓDIGO ATUAL (com bug)
const newContactData = {
  full_name: row.nome.trim(),
  phone: normalizedPhone,
  assigned_to: options.defaultAssigneeId || null,  // ❌ Ignora vendedor da planilha
};
```

### Bug #2: Status de Lead Ignorado para Novos Contatos
**Localização:** Linhas 431-436 e 488-500

O `lead_status` só é processado para contatos existentes. Novos contatos são criados sem status, mesmo que a planilha contenha "(2) Abordagem", "(4) Cursos", etc.

### Bug #3: Tags Não Associadas a Novos Contatos
**Localização:** Linhas 656-664

Quando processa tags (Fase 5), o código tenta encontrar o `contactId` no cache. Porém, novos contatos criados via batch insert são adicionados ao `createdContactsMap` com o `phone` exato, mas a busca usa `variations` que pode não coincidir, resultando em `contactId = null` e tags não associadas.

---

## ✅ Correções Propostas

### Correção 1: Usar Vendedor da Planilha ao Criar Contatos

**Arquivo:** `src/hooks/useImportContacts.ts`

Mover a lógica de resolução do `assigneeId` para **antes** da criação do contato, e usar esse valor:

```typescript
// ANTES de criar o contato, resolver o vendedor
let assigneeId: string | null = null;
if (options.defaultAssigneeId) {
  assigneeId = options.defaultAssigneeId;
} else if (options.updateAssignee && row.vendedor && row.vendedor.trim()) {
  const agent = findProfileByName(row.vendedor);
  if (agent) {
    assigneeId = agent.id;
  }
}

// Ao criar contato, usar assigneeId resolvido
const newContactData = {
  full_name: row.nome.trim(),
  phone: normalizedPhone,
  state: identifiedState || null,
  assigned_to: assigneeId,  // ✅ Usa vendedor da planilha
};
```

### Correção 2: Incluir Status de Lead ao Criar Contatos

Resolver o status **antes** de criar o contato e incluir na criação:

```typescript
// Resolver status de lead
let leadStatusName: string | null = null;
if (options.updateLeadStatus && row.statusLead && row.statusLead.trim()) {
  const status = await findOrCreateLeadStatus(row.statusLead);
  if (status) {
    leadStatusName = status.name;
  }
}

// Ao criar contato, incluir lead_status
const newContactData = {
  full_name: row.nome.trim(),
  phone: normalizedPhone,
  state: identifiedState || null,
  assigned_to: assigneeId,
  lead_status: leadStatusName,  // ✅ Inclui status
};
```

### Correção 3: Garantir Associação de Tags para Novos Contatos

Na Fase 5, adicionar também busca no `createdContactsMap` pelo phone normalizado:

```typescript
let contactId: string | null = null;

// Primeiro, tentar pelo phone normalizado exato no createdContactsMap
if (createdContactsMap.has(normalizedPhone)) {
  contactId = createdContactsMap.get(normalizedPhone)!;
}

// Se não encontrou, tentar pelas variações no contactsCache
if (!contactId) {
  for (const v of variations) {
    if (contactsCache.has(v)) {
      contactId = contactsCache.get(v)!.id;
      break;
    }
  }
}
```

---

## 📁 Arquivos a Modificar

| Arquivo | Tipo de Mudança |
|---------|-----------------|
| `src/hooks/useImportContacts.ts` | Refatorar lógica de criação de contatos |

---

## 🧪 Validação

Após implementação, testar com:
1. Arquivo CSV com vendedores mapeados
2. Verificar se contatos novos recebem `assigned_to` do vendedor da planilha
3. Verificar se `lead_status` é atribuído corretamente
4. Verificar se tags são associadas via `contact_tags`

---

## 📊 Estimativa

- **Complexidade:** Média
- **Risco:** Baixo (lógica incremental, não quebra fluxo existente)
- **Arquivos afetados:** 1

