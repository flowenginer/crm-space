

## Diagnóstico: "Código não encontrado"

O erro ocorre porque `searchParams.get('code')` retorna `null` na página de callback. Possíveis causas:

1. **Facebook adiciona `#_=_`** ao final da URL de redirect, o que pode interferir com o parsing dos parâmetros em alguns cenários
2. **O `response_type=code` não está explícito** na URL do OAuth — embora seja o default, é boa prática incluir
3. **O popup pode ter sido redirecionado sem completar o fluxo** (ex: o usuário fechou antes de autorizar)

## Correções

### 1. Edge Function `instagram-oauth` — Adicionar `response_type=code`
- Na action `get-login-url`, adicionar `&response_type=code` explicitamente na URL do OAuth

### 2. Callback Page — Tratar `#_=_` do Facebook e adicionar debug
- Antes de ler os searchParams, limpar o hash `#_=_` que o Facebook adiciona
- Se a URL atual tiver `code` no hash ou em `window.location.search` direto (fallback), tentar extrair de lá
- Adicionar um `console.log` temporário com a URL completa para debugar caso o erro persista

### Arquivos modificados
| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/instagram-oauth/index.ts` | Adicionar `response_type=code` na URL |
| `src/pages/InstagramOAuthCallback.tsx` | Tratar `#_=_`, fallback para `window.location.search`, log de debug |

