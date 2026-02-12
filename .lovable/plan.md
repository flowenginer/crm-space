
# Correção: CRM travado na tela de carregamento

## Problema
O CRM fica preso na tela "Carregando..." porque o hook `useAuth.ts` dispara múltiplas requisições duplicadas para buscar perfil e tenant. O Supabase cancela as requisições anteriores (AbortError), e o perfil nunca é carregado com sucesso, impedindo a inicialização da Sidebar e de todo o app.

## Causa Raiz
O `onAuthStateChange` dispara `SIGNED_IN` duas vezes seguidas + `INITIAL_SESSION`, e o `getSession()` também executa a mesma logica de fetch. Isso gera 4 chamadas concorrentes que se cancelam mutuamente.

## Solucao

### Arquivo: `src/hooks/useAuth.ts`

1. **Adicionar controle de deduplicacao com `useRef`**: Usar um ref para rastrear se um fetch ja esta em andamento, impedindo chamadas duplicadas.

2. **Remover logica duplicada do `getSession()`**: O `getSession()` no final do `useEffect` repete exatamente a mesma logica do `onAuthStateChange`. Sera simplificado para apenas definir sessao/usuario, sem buscar perfil novamente (o `onAuthStateChange` ja cuida disso).

3. **Adicionar guard no `onAuthStateChange`**: Verificar se o userId mudou antes de refazer o fetch, evitando que eventos duplicados de `SIGNED_IN` disparem buscas redundantes.

### Mudancas especificas:

```text
useAuth.ts (antes):
  - onAuthStateChange(SIGNED_IN) → fetch profile+roles (duplicado)
  - onAuthStateChange(INITIAL_SESSION) → fetch profile+roles (duplicado)  
  - getSession() → fetch profile+roles (duplicado)
  = 4 fetches concorrentes → AbortError

useAuth.ts (depois):
  - useRef para tracking: fetchingForUserId, profileLoadedForUserId
  - onAuthStateChange → fetch SOMENTE se userId diferente e nao em andamento
  - getSession() → apenas setSession/setUser, sem fetch duplicado
  = 1 fetch limpo → perfil carrega com sucesso
```

### Detalhes tecnicos da implementacao:

- Adicionar `const fetchingRef = useRef<string | null>(null)` para impedir chamadas concorrentes
- Adicionar `const loadedRef = useRef<string | null>(null)` para evitar re-fetch desnecessario
- No callback do `onAuthStateChange`: checar `if (fetchingRef.current === userId || loadedRef.current === userId) return` antes de buscar
- No `getSession()`: remover toda a logica de fetch de profile/roles, manter apenas `setSession`, `setUser`, `setIsLoading(false)` e sincronizacao do Realtime token
- Manter o `try/catch` existente com logging de erro

### Impacto
- Corrige o travamento na tela de carregamento
- Nenhuma mudanca funcional: mesmos dados sao buscados, apenas sem duplicacao
- A Sidebar passa a receber as permissoes corretamente e renderiza o menu
