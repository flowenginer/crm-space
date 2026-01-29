
# Plano de Correção Completa: Importação de Contatos

## Problemas Identificados

### 1. Status de Lead Não Encontrados

**Planilha vs Banco:**
| Planilha | Banco | Match? |
|----------|-------|--------|
| `ATENDIMENTO` | `Atendimento` | ✅ (case fix) |
| `ABORDAGEM SEM RESPOSTA` | ❌ Não existe | ❌ |
| `AGENDAMENTO` | `Agendado` | ❌ Nome diferente |
| `FORA DE PERFIL` | `Fora de perfil` | ✅ (case fix) |
| `SEM INTERESSE` | `Sem Interesse` | ✅ (case fix) |
| `(1) Pré-contato` | `02 - Pré-venda` | ❌ Nome diferente |
| `(5) Oferta` | `05 - Orçamento` | ❌ Nome diferente |
| `(2) Abordagem` | ❌ Não existe | ❌ |

**Causa:** O algoritmo de matching não consegue mapear nomes muito diferentes.

**Solução:** Criar os status que não existem automaticamente durante a importação.

---

### 2. Atendente "Beatriz" Não Atribuído

O perfil `Beatriz` existe no banco (`id: e7a9fd22-e3ff-40b9-b01c-93549db399d0`).

**Causa provável:**
- Na planilha a coluna é chamada `Agente`, mas o código procura `vendedor`
- O mapeamento de colunas pode estar incorreto

**Solução:** 
- Verificar o mapeamento de colunas no processamento da planilha
- Garantir que `Agente` seja mapeado para `row.vendedor`

---

### 3. Erro RLS ao Criar Tags

```
"Tenant isolation for tags" for table "tags"
```

**Causa:** A RLS policy não tem `WITH CHECK`, então inserts falham. A tabela `tags` tem `tenant_id` com default para master tenant, mas a RLS exige que seja igual ao tenant do usuário.

**Solução:** A função `findOrCreateTag` precisa definir `tenant_id` como `NULL` para deixar o trigger `set_tenant_id_from_user` preencher corretamente.

---

### 4. Criar Status/Tags Automaticamente

**Solução:** Implementar uma função `findOrCreateLeadStatus` similar à `findOrCreateTag`, que:
1. Busca o status pelo nome (fuzzy matching)
2. Se não encontrar, cria um novo status com o nome da planilha

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useTags.ts` | `findOrCreateTag`: definir `tenant_id` como `NULL` para evitar erro RLS |
| `src/hooks/useImportContacts.ts` | Adicionar `findOrCreateLeadStatus` + melhorar matching de colunas |

---

## Alterações Técnicas

### 1. Corrigir `findOrCreateTag` para RLS

```typescript
// src/hooks/useTags.ts
export async function findOrCreateTag(name: string, preferredColor?: string) {
  const existing = await findTagByName(name);
  if (existing) return { ...existing, isNew: false };
  
  const { data: { user } } = await supabase.auth.getUser();
  const color = preferredColor || TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
  
  const { data, error } = await supabase
    .from('tags')
    .insert({ 
      name: name.trim(), 
      color, 
      visibility: 'public',
      created_by: user?.id,
      tenant_id: null, // DEIXAR O TRIGGER PREENCHER!
    } as any)
    .select()
    .single();
  
  if (error) throw error;
  return { ...data, isNew: true };
}
```

### 2. Adicionar `findOrCreateLeadStatus` 

```typescript
// src/hooks/useImportContacts.ts

async function findOrCreateLeadStatus(
  name: string, 
  leadStatusesCache: Map<string, LeadStatusCache>
): Promise<LeadStatusCache | null> {
  // Primeiro tenta encontrar com matching fuzzy
  const found = findLeadStatus(name);
  if (found) return found;
  
  // Se não encontrou, criar novo status
  const cleanName = name
    .replace(/^\(\d+\)\s*/, '')
    .replace(/^\d+\s*[-–]\s*/, '')
    .trim();
  
  // Buscar próximo order_position
  const { data: maxOrder } = await supabase
    .from('lead_statuses')
    .select('order_position')
    .order('order_position', { ascending: false })
    .limit(1)
    .single();
  
  const nextOrder = (maxOrder?.order_position || 0) + 1;
  
  const { data, error } = await supabase
    .from('lead_statuses')
    .insert({
      name: cleanName,
      order_position: nextOrder,
      color: '#8B5CF6',
      is_active: true,
      tenant_id: null, // Trigger preenche
    } as any)
    .select('id, name')
    .single();
  
  if (error) {
    console.error('Erro ao criar lead status:', error);
    return null;
  }
  
  // Adicionar ao cache
  leadStatusesCache.set(cleanName.toLowerCase(), data);
  return data;
}
```

### 3. Melhorar Mapeamento de Colunas

Garantir que colunas alternativas como `Agente` sejam mapeadas para `vendedor`:

```typescript
// No componente de importação (modal/form)
// Mapear: Agente → vendedor
const normalizedRow: ImportRow = {
  nome: row.Nome || row.nome || '',
  telefone: row.Contato || row.telefone || row.Telefone || '',
  vendedor: row.Agente || row.vendedor || row.Vendedor || '',
  etiquetas: row.Etiquetas || row.etiquetas || '',
  statusLead: row['Status Lead'] || row.statusLead || row.StatusLead || '',
};
```

---

## Fluxo Corrigido

```text
1. Carregar planilha CSV
   ↓
2. Mapear colunas (Agente → vendedor, Status Lead → statusLead)
   ↓
3. Para cada linha:
   ├── Buscar contato existente
   ├── Encontrar vendedor por nome ("Beatriz" → e7a9fd22...)
   ├── Encontrar ou CRIAR lead status
   │   └── Se não existe "ABORDAGEM SEM RESPOSTA" → criar
   ├── Encontrar ou CRIAR tags
   │   └── Se não existe "(E2) Emprega Mais" → criar (com tenant_id = null)
   └── Atribuir ao contato
```

---

## Resultado Esperado

1. **Beatriz será atribuída** - coluna `Agente` mapeada corretamente
2. **Status criados automaticamente** - "ABORDAGEM SEM RESPOSTA", "AGENDAMENTO", "(1) Pré-contato", etc.
3. **Tags criadas sem erro RLS** - `tenant_id` gerenciado pelo trigger
4. **Importação completa** - 0 erros "Status não encontrado"
