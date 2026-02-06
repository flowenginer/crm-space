

# Correção: Forçar Deploy do `distribute-lead` com Verificação

## Diagnóstico

O código no repositório **JA ESTA CORRETO** -- a linha 382 de `distribute-lead/index.ts` inclui `tenant_id: tenantId`. Porém, os logs de produção de agora (17:33 UTC) **ainda mostram o erro P0001**, o que prova que a versão deployada NAO e a versão atual do código.

## Plano

### 1. Adicionar constante VERSION ao `distribute-lead`

Adicionar `const VERSION = '2026-02-06-v2';` no topo do arquivo e logar no início da execução. Isso permite confirmar nos logs que a versão correta foi deployada.

### 2. Forçar redeploy

Redeployar a função `distribute-lead` (e `execute-flow-node` por segurança).

### 3. Verificar nos logs

Após o deploy, verificar nos logs se a nova versão aparece e se o erro P0001 desaparece.

## Arquivo alterado

| Arquivo | Alteração |
|---|---|
| `supabase/functions/distribute-lead/index.ts` | Adicionar `const VERSION = '2026-02-06-v2'` e log da versão no início da execução |

## Resultado Esperado

- Logs mostram `[distribute-lead] VERSION: 2026-02-06-v2` confirmando deploy correto
- Erro P0001 desaparece
- "Atendente Atual" é preenchido corretamente para todos os tenants

