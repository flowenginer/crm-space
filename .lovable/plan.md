

## Plano: Corrigir Erros de Build + Debounce no Envio de Áudio

### 1. Corrigir erros de tipo no `cross-reference-sales/index.ts`
**Linha 445**: `error` é do tipo `unknown`. Corrigir com cast: `(error as Error).message`

### 2. Corrigir erros de tipo no `whatsapp-webhook/index.ts`
**Linha 1138**: O `select("id, phone")` do contato não inclui `full_name`. O código na linha 1924 tenta acessar `contact.full_name` e `contact.phone` — `phone` existe mas `full_name` não. Solução: já existe `contactData` como fallback, basta remover as referências a `contact.full_name` e `contact.phone` nesse bloco (usar só `contactData`).

**Linha 2148**: O tipo explícito `{ id: any; full_name: any; phone: any; department_id: any; }` não inclui `lead_status`. Solução: adicionar `lead_status` ao tipo e ao `select` da query que popula esse contato.

### 3. Debounce no envio de áudio (Conversations.tsx)
O guard `isSendingRef.current` já existe na linha 3691, mas é setado apenas na linha 3706 — há uma janela entre a verificação e a atribuição onde cliques rápidos passam. Solução: mover `isSendingRef.current = true` para imediatamente após a verificação (linha 3692), antes de qualquer operação assíncrona.

### Arquivos alterados
- `supabase/functions/cross-reference-sales/index.ts` — cast de error
- `supabase/functions/whatsapp-webhook/index.ts` — corrigir tipos do contact
- `src/pages/Conversations.tsx` — mover guard do debounce

