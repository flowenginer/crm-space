

## Plano: Corrigir build + Tornar canal Instagram visível para vendedores

### Problema 1: Erro de build no `whatsapp-webhook/index.ts`
**Linha 1214**: O upsert de contato faz `.select("id")`, mas depois o código acessa `contact.full_name` e `contact.phone` (linha 1924-1925).

**Correção**: Alterar linha 1214 de `.select("id")` para `.select("id, phone, full_name")`.

### Problema 2: Canal Instagram não aparece para vendedores
O hook `useUserChannels` filtra canais por departamento para vendedores. O canal do Instagram provavelmente tem um `department_id` atribuído que não coincide com o departamento dos vendedores — por isso só aparece para admins.

**Correção**: No `useUserChannels.ts`, na lógica de fallback por departamento (linha 80), adicionar uma exceção para canais do tipo `instagram` — eles devem sempre aparecer no filtro para todos os usuários, independente do departamento.

### Arquivos alterados
- `supabase/functions/whatsapp-webhook/index.ts` — linha 1214: expandir select do upsert
- `src/hooks/useUserChannels.ts` — linha 80: incluir canais Instagram no filtro de todos os perfis

