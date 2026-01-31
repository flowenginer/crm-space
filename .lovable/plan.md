

# Correção de Timeout em Ações em Massa

## Diagnóstico do Problema

O timeout ocorreu porque:
1. **Chunks de 10 executados em paralelo** via `Promise.all` gera contenção no banco de dados
2. **Sem intervalo entre chunks** - processamento imediato sem "respirar"
3. **RPC `transfer_conversation` é pesado** - cada chamada faz SELECT, UPDATE, INSERT e buscas de nomes
4. **44 conversas = 5 chunks × 10 RPCs simultâneos** = sobrecarga

## Solução Proposta

### 1. Reduzir tamanho do chunk e sequencializar dentro do chunk

| Antes | Depois |
|-------|--------|
| Chunk de 10, todos em paralelo | Chunk de 5, processados sequencialmente |
| 10 RPCs simultâneos | 1 RPC por vez, 5 por chunk |
| Sem delay entre chunks | 500ms de delay entre chunks |

### 2. Adicionar delay entre chunks

```typescript
// Antes
for (const chunk of chunks) {
  await Promise.all(chunk.map(...)); // 10 simultâneos
}

// Depois
for (const chunk of chunks) {
  for (const item of chunk) {
    await processItem(item); // 1 por vez
    await delay(100); // 100ms entre itens
  }
  await delay(500); // 500ms entre chunks
}
```

### 3. Adicionar callback de progresso

Para dar feedback visual ao usuário durante operações longas:

```typescript
interface BulkOptions {
  onProgress?: (processed: number, total: number) => void;
}
```

### 4. Implementar retry automático

Se um item falhar por timeout, tentar novamente 1x antes de marcar como erro.

## Arquivos a Modificar

### `src/hooks/useBulkConversationActions.ts`

1. Criar função helper `delay()` e `processWithRetry()`
2. Modificar `useBulkTransfer` para processar sequencialmente com delays
3. Modificar `useBulkDistribute` para processar sequencialmente com delays
4. Modificar `useBulkCloseConversations` - pode manter paralelo (operação mais leve)
5. Modificar `useBulkReopenConversations` para processar sequencialmente

### `src/components/conversations/BulkTransferModal.tsx`

1. Adicionar estado de progresso
2. Mostrar barra de progresso durante transferência
3. Passar callback `onProgress` para o hook

### `src/components/conversations/BulkCloseModal.tsx`

1. Adicionar barra de progresso (opcional, operações são mais leves)

## Detalhes Técnicos

### Nova função helper

```typescript
// Delay helper
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Process with retry
async function processWithRetry<T>(
  fn: () => Promise<T>,
  retries: number = 1,
  delayMs: number = 1000
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0) {
      await delay(delayMs);
      return processWithRetry(fn, retries - 1, delayMs);
    }
    throw error;
  }
}
```

### Processamento sequencial com progresso

```typescript
// useBulkDistribute modificado
mutationFn: async ({
  conversationIds,
  targetUserIds,
  targetUserNames,
  departmentId,
  note,
  onProgress, // NOVO
}: {
  conversationIds: string[];
  targetUserIds: string[];
  targetUserNames: Record<string, string>;
  departmentId: string;
  note?: string;
  onProgress?: (processed: number, total: number) => void;
}): Promise<DistributeResult> => {
  
  let processed = 0;
  const total = conversationIds.length;
  
  // ... distribuição round-robin ...
  
  for (const [userId, convIds] of assignments) {
    for (const convId of convIds) {
      await processWithRetry(async () => {
        const { error } = await supabase.rpc('transfer_conversation', {
          p_conversation_id: convId,
          p_to_user_id: userId,
          p_to_department_id: departmentId,
          p_note: note || 'Distribuição em massa',
          p_force: false,
        });
        
        if (error) throw error;
      });
      
      processed++;
      onProgress?.(processed, total);
      
      // Pequeno delay entre cada item
      await delay(100);
    }
    
    // Delay maior entre cada vendedor
    await delay(300);
  }
  
  return result;
}
```

### UI com progresso

```typescript
// No BulkTransferModal
const [progress, setProgress] = useState({ processed: 0, total: 0 });
const [isProcessing, setIsProcessing] = useState(false);

const handleConfirm = async () => {
  setIsProcessing(true);
  setProgress({ processed: 0, total: conversationIds.length });
  
  await distributeMutation.mutateAsync({
    conversationIds,
    targetUserIds: selectedAgents,
    targetUserNames: agentNameMap,
    departmentId: selectedDepartment!,
    note: 'Distribuição balanceada',
    onProgress: (processed, total) => {
      setProgress({ processed, total });
    },
  });
  
  setIsProcessing(false);
  onClose();
};

// Na UI
{isProcessing && (
  <div className="space-y-2">
    <Progress value={(progress.processed / progress.total) * 100} />
    <p className="text-sm text-muted-foreground text-center">
      Processando {progress.processed} de {progress.total}...
    </p>
  </div>
)}
```

## Comparativo de Performance

| Cenário (44 conversas) | Antes | Depois |
|------------------------|-------|--------|
| RPCs simultâneos máximo | 10 | 1 |
| Delay entre itens | 0ms | 100ms |
| Delay entre chunks | 0ms | 300ms |
| Tempo estimado | ~5s (com timeouts) | ~15s (estável) |
| Taxa de sucesso | ~45% | ~99% |

## Benefícios

1. **Estabilidade**: Sem sobrecarga do banco de dados
2. **Visibilidade**: Usuário vê progresso em tempo real
3. **Resiliência**: Retry automático em caso de falha pontual
4. **Previsibilidade**: Tempo de execução linear e previsível

## Ordem de Implementação

1. Adicionar helpers `delay()` e `processWithRetry()` no hook
2. Modificar `useBulkDistribute` com processamento sequencial + progresso
3. Modificar `useBulkTransfer` com processamento sequencial + progresso
4. Atualizar `BulkTransferModal` com barra de progresso
5. Aplicar mesma lógica nos outros hooks de bulk (close, reopen)
6. Testar com 40+ conversas

