

# Centro de Ações em Massa para Atendimentos

## Resumo Executivo

Este plano implementa um **Centro de Ações em Massa** integrado à página "Consultar Atendimentos", permitindo realizar operações como transferência, fechamento, etiquetagem e alteração de status em múltiplos atendimentos simultaneamente. 

O diferencial será a **Distribuição Balanceada/Randomizada**: ao transferir clientes de um vendedor que saiu, você poderá selecionar múltiplos vendedores destino e o sistema distribuirá automaticamente de forma equilibrada entre eles.

---

## Funcionalidades Principais

| Ação | Descrição | Modo |
|------|-----------|------|
| **Transferir** | Para um vendedor específico OU distribuição balanceada entre múltiplos vendedores | Único ou Múltiplo |
| **Fechar Conversa** | Encerrar atendimentos selecionados | Em lote |
| **Aplicar Etiqueta** | Adicionar tag aos contatos | Em lote |
| **Remover Etiqueta** | Remover tag dos contatos | Em lote |
| **Alterar Status do Lead** | Mudar etapa do funil | Em lote |
| **Reabrir Conversa** | Reabrir atendimentos fechados | Em lote |

---

## Fluxo de Usuário: Distribuição Balanceada

```text
Cenário: Yasmim foi desligada e seus 30 clientes precisam ser redistribuídos

1. Admin acessa "Consultar Atendimentos"
2. Filtra por Agente = "Yasmim" 
3. Clica "GERAR" → aparecem os 30 clientes
4. Marca "Selecionar Todos" (ou seleciona manualmente)
5. Barra de ações aparece: "30 selecionados"
6. Clica em "Transferir"
7. Modal abre com 2 opções:
   ├─ ○ Para um vendedor específico (comportamento atual)
   └─ ● Distribuir entre vendedores (NOVA OPÇÃO)
8. Ao selecionar "Distribuir entre vendedores":
   - Escolhe o departamento
   - Marca os vendedores destino (ex: João, Maria, Pedro)
   - Sistema calcula: 30 ÷ 3 = 10 clientes para cada
9. Clica "Confirmar Distribuição"
10. Sistema processa e mostra:
    "✓ 30 transferidos: João (10), Maria (10), Pedro (10)"
```

---

## Arquitetura da Solução

### Novos Hooks em `useBulkConversationActions.ts`

```text
┌────────────────────────────────────────────────────────────────────┐
│                    useBulkConversationActions.ts                   │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  [Existente] useBulkTransfer()                                     │
│  [Existente] useBulkReturnToOriginalAgent()                        │
│                                                                    │
│  [NOVO] useBulkDistribute() ─────► Distribuição balanceada         │
│         - Recebe: conversationIds[], userIds[], departmentId       │
│         - Embaralha conversas (randomização)                       │
│         - Divide igualmente entre vendedores                       │
│         - Retorna: { distributions: [{userId, count}], ... }       │
│                                                                    │
│  [NOVO] useBulkCloseConversations()                                │
│         - Atualiza status='closed', closed_at, closed_by           │
│         - Registra evento de fechamento                            │
│                                                                    │
│  [NOVO] useBulkAddTag()                                            │
│         - Insere em contact_tags com upsert                        │
│                                                                    │
│  [NOVO] useBulkRemoveTag()                                         │
│         - Remove de contact_tags                                   │
│                                                                    │
│  [NOVO] useBulkUpdateLeadStatus()                                  │
│         - Atualiza contacts.lead_status                            │
│                                                                    │
│  [NOVO] useBulkReopenConversations()                               │
│         - Atualiza status='open', reopen_count++, reopened_at      │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### Algoritmo de Distribuição Balanceada

```text
┌─────────────────────────────────────────────────────────────────┐
│                   ALGORITMO DE DISTRIBUIÇÃO                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Entrada:                                                       │
│    - conversationIds: [c1, c2, c3, ..., c30]                    │
│    - targetUserIds: [João, Maria, Pedro]                        │
│    - departmentId: "vendas"                                     │
│                                                                 │
│  Passo 1: Embaralhar conversas (Fisher-Yates shuffle)           │
│    shuffled = [c14, c7, c22, c1, c30, ...]                      │
│                                                                 │
│  Passo 2: Calcular distribuição                                 │
│    total = 30, vendedores = 3                                   │
│    base = Math.floor(30 / 3) = 10                               │
│    resto = 30 % 3 = 0                                           │
│                                                                 │
│  Passo 3: Atribuir via round-robin                              │
│    João:  [c14, c1, c12, ...]  = 10 conversas                   │
│    Maria: [c7, c30, c5, ...]   = 10 conversas                   │
│    Pedro: [c22, c8, c19, ...]  = 10 conversas                   │
│                                                                 │
│  Saída:                                                         │
│    { success: 30, failed: 0,                                    │
│      distributions: [                                           │
│        { userId: "João", count: 10 },                           │
│        { userId: "Maria", count: 10 },                          │
│        { userId: "Pedro", count: 10 }                           │
│      ] }                                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Novos Componentes

```text
src/components/conversations/
├── BulkActionsBar.tsx         [NOVO] Barra flutuante de ações
├── BulkTransferModal.tsx      [MODIFICAR] Adicionar modo "distribuir"
├── BulkCloseModal.tsx         [NOVO] Modal para fechar em massa
├── BulkTagModal.tsx           [NOVO] Modal para gerenciar etiquetas
├── BulkLeadStatusModal.tsx    [NOVO] Modal para alterar status do lead
└── ...
```

---

## Detalhamento Técnico

### 1. Hook `useBulkDistribute` (novo)

```typescript
interface DistributeResult {
  success: number;
  failed: number;
  errors: string[];
  distributions: Array<{
    userId: string;
    userName: string;
    count: number;
  }>;
}

export function useBulkDistribute() {
  return useMutation({
    mutationFn: async ({
      conversationIds,
      targetUserIds,
      departmentId,
      note,
    }: {
      conversationIds: string[];
      targetUserIds: string[];  // Múltiplos vendedores
      departmentId: string;
      note?: string;
    }): Promise<DistributeResult> => {
      
      // 1. Embaralhar conversas (randomização)
      const shuffled = shuffleArray([...conversationIds]);
      
      // 2. Distribuir igualmente via round-robin
      const assignments = new Map<string, string[]>();
      targetUserIds.forEach(id => assignments.set(id, []));
      
      shuffled.forEach((convId, index) => {
        const targetUser = targetUserIds[index % targetUserIds.length];
        assignments.get(targetUser)!.push(convId);
      });
      
      // 3. Processar transferências em chunks
      const result = { success: 0, failed: 0, errors: [], distributions: [] };
      
      for (const [userId, convIds] of assignments) {
        for (const convId of convIds) {
          await supabase.rpc('transfer_conversation', {
            p_conversation_id: convId,
            p_to_user_id: userId,
            p_to_department_id: departmentId,
            p_note: note || 'Distribuição em massa',
            p_force: false,
          });
          result.success++;
        }
        result.distributions.push({ userId, count: convIds.length });
      }
      
      return result;
    }
  });
}

// Fisher-Yates shuffle
function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
```

### 2. Componente `BulkActionsBar`

Barra flutuante que aparece quando há conversas selecionadas:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│  ☑ 30 selecionados  │ Transferir │ Fechar │ Etiqueta │ Status │ Reabrir │
└─────────────────────────────────────────────────────────────────────────┘
```

- Aparece com animação (slide-up)
- Mostra contador de selecionados
- Botões contextuais baseados no status das conversas
- Botão "Limpar seleção"

### 3. Modal de Transferência Aprimorado

O `BulkTransferModal` existente será expandido para suportar dois modos:

```text
┌──────────────────────────────────────────────────────────────────┐
│                     Transferir em Lote                           │
│                     30 conversa(s) selecionada(s)                │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Modo de transferência:                                          │
│                                                                  │
│  ┌─────────────────────┐  ┌─────────────────────┐                │
│  │ ○ Para um vendedor  │  │ ● Distribuir entre  │                │
│  │   específico        │  │   vendedores        │                │
│  │   Atribuição direta │  │   Divisão igualitária               │
│  └─────────────────────┘  └─────────────────────┘                │
│                                                                  │
│  Departamento: [▼ Vendas                    ]                    │
│                                                                  │
│  Vendedores destino: (selecione 2 ou mais)                       │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐                    │
│  │ ☑ João     │ │ ☑ Maria    │ │ ☑ Pedro    │                    │
│  │ (10)       │ │ (10)       │ │ (10)       │                    │
│  └────────────┘ └────────────┘ └────────────┘                    │
│                                                                  │
│  Prévia: 30 conversas ÷ 3 vendedores = 10 cada                   │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│                              [Cancelar]  [Confirmar Distribuição]│
└──────────────────────────────────────────────────────────────────┘
```

### 4. Hooks Adicionais

```typescript
// Fechar conversas em massa
export function useBulkCloseConversations() {
  return useMutation({
    mutationFn: async ({ 
      conversationIds, 
      closeReason 
    }: { 
      conversationIds: string[]; 
      closeReason?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Processar em chunks de 10
      for (const chunk of chunkArray(conversationIds, 10)) {
        await Promise.all(chunk.map(id => 
          supabase.rpc('close_conversation', {
            p_conversation_id: id,
            p_close_reason: closeReason || null,
            p_notes: 'Fechamento em massa'
          })
        ));
      }
    }
  });
}

// Adicionar etiqueta em massa
export function useBulkAddTag() {
  return useMutation({
    mutationFn: async ({ 
      contactIds, 
      tagId 
    }: { 
      contactIds: string[]; 
      tagId: string;
    }) => {
      // Usar upsert para evitar duplicatas
      const inserts = contactIds.map(contactId => ({
        contact_id: contactId,
        tag_id: tagId
      }));
      
      await supabase
        .from('contact_tags')
        .upsert(inserts, { onConflict: 'contact_id,tag_id' });
    }
  });
}

// Remover etiqueta em massa
export function useBulkRemoveTag() {
  return useMutation({
    mutationFn: async ({ 
      contactIds, 
      tagId 
    }: { 
      contactIds: string[]; 
      tagId: string;
    }) => {
      await supabase
        .from('contact_tags')
        .delete()
        .in('contact_id', contactIds)
        .eq('tag_id', tagId);
    }
  });
}

// Alterar status do lead em massa
export function useBulkUpdateLeadStatus() {
  return useMutation({
    mutationFn: async ({ 
      contactIds, 
      leadStatus 
    }: { 
      contactIds: string[]; 
      leadStatus: string;
    }) => {
      await supabase
        .from('contacts')
        .update({ lead_status: leadStatus })
        .in('id', contactIds);
    }
  });
}

// Reabrir conversas em massa
export function useBulkReopenConversations() {
  return useMutation({
    mutationFn: async (conversationIds: string[]) => {
      const now = new Date().toISOString();
      
      for (const id of conversationIds) {
        await supabase
          .from('conversations')
          .update({
            status: 'open',
            reopened_at: now,
            reopen_count: supabase.raw('COALESCE(reopen_count, 0) + 1')
          })
          .eq('id', id);
      }
    }
  });
}
```

---

## Modificações na Página ConversationReport

### Novos Estados

```typescript
const [showBulkActionsBar, setShowBulkActionsBar] = useState(false);
const [bulkTransferModalOpen, setBulkTransferModalOpen] = useState(false);
const [bulkCloseModalOpen, setBulkCloseModalOpen] = useState(false);
const [bulkTagModalOpen, setBulkTagModalOpen] = useState(false);
const [bulkLeadStatusModalOpen, setBulkLeadStatusModalOpen] = useState(false);
```

### Dados Selecionados Enriquecidos

```typescript
// Mapear IDs selecionados para dados completos
const selectedConversationsData = useMemo(() => {
  if (!reportData?.conversations) return [];
  return reportData.conversations.filter(c => selectedRows.has(c.id));
}, [reportData, selectedRows]);

// Extrair contact_ids únicos
const selectedContactIds = useMemo(() => {
  return [...new Set(selectedConversationsData.map(c => c.contact_id))];
}, [selectedConversationsData]);
```

### Integração da Barra de Ações

```tsx
{/* Barra de ações em massa - aparece quando há seleção */}
{selectedRows.size > 0 && (
  <BulkActionsBar
    selectedCount={selectedRows.size}
    selectedConversations={selectedConversationsData}
    onClearSelection={() => {
      setSelectedRows(new Set());
      setSelectAll(false);
    }}
    onTransfer={() => setBulkTransferModalOpen(true)}
    onClose={() => setBulkCloseModalOpen(true)}
    onAddTag={() => setBulkTagModalOpen(true)}
    onChangeLeadStatus={() => setBulkLeadStatusModalOpen(true)}
    onReopen={handleBulkReopen}
  />
)}

{/* Modais */}
<BulkTransferModal
  open={bulkTransferModalOpen}
  onClose={() => setBulkTransferModalOpen(false)}
  conversationIds={Array.from(selectedRows)}
  onTransferSuccess={handleBulkSuccess}
/>

<BulkCloseModal ... />
<BulkTagModal ... />
<BulkLeadStatusModal ... />
```

---

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/hooks/useBulkConversationActions.ts` | Expandir | Adicionar 5 novos hooks incluindo `useBulkDistribute` |
| `src/components/conversations/BulkActionsBar.tsx` | Criar | Barra flutuante de ações |
| `src/components/conversations/BulkTransferModal.tsx` | Modificar | Adicionar modo "distribuir entre vendedores" |
| `src/components/conversations/BulkCloseModal.tsx` | Criar | Modal para fechamento em massa |
| `src/components/conversations/BulkTagModal.tsx` | Criar | Modal para gerenciar etiquetas |
| `src/components/conversations/BulkLeadStatusModal.tsx` | Criar | Modal para alterar status do lead |
| `src/pages/ConversationReport.tsx` | Modificar | Integrar barra de ações e modais |

---

## Considerações de Performance

1. **Chunks de 10**: Todas as operações são processadas em lotes de 10 para não sobrecarregar o servidor
2. **Progress Bar**: UI mostra progresso durante operações longas
3. **Promise.all por chunk**: Paralelismo dentro de cada chunk
4. **Invalidação de queries**: Refresh automático após conclusão

---

## Feedback ao Usuário

### Toast de Sucesso com Detalhes
```
✓ Distribuição concluída!
  30 conversas transferidas:
  • João: 10
  • Maria: 10  
  • Pedro: 10
```

### Toast de Falha Parcial
```
⚠ Distribuição parcial
  28 sucesso, 2 falhas
  [Ver detalhes]
```

---

## Ordem de Implementação

1. Expandir `useBulkConversationActions.ts` com todos os novos hooks
2. Criar `BulkActionsBar.tsx`
3. Modificar `BulkTransferModal.tsx` para suportar distribuição
4. Criar `BulkCloseModal.tsx`
5. Criar `BulkTagModal.tsx`
6. Criar `BulkLeadStatusModal.tsx`
7. Integrar tudo em `ConversationReport.tsx`
8. Testar cada ação individualmente

