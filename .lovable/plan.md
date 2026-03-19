

# Diagnóstico: Mensagens não entregues no WhatsApp

## O que aconteceu

Analisando os logs e o banco de dados, identifiquei que **3 disparos foram criados em 10 segundos** (16:51:33, 16:51:40, 16:51:43) — todos com o mesmo template `promo_brasil` para os mesmos 4 contatos:

| Dispatch | Criado em | Enviados |
|---|---|---|
| 33621da1 | 16:51:33 | 4 |
| 33a4237c | 16:51:40 | 3 (pausado) |
| 25c18ae5 | 16:51:43 | 4 |

**Total: 11 envios** do mesmo template para os mesmos 4 números em ~30 segundos. Somando os testes anteriores (16:09-16:26, mais 5 disparos com erro), esses números receberam o template `promo_brasil` **dezenas de vezes** hoje.

A Meta aceitou todos (`accepted`) mas **suprimiu a entrega** por detecção de spam/duplicação. Por isso ninguém recebeu no WhatsApp.

## Causa raiz

O botão "Iniciar Disparo" não está protegido contra cliques múltiplos de forma eficaz. O `disabled` verifica `createDispatch.isPending`, mas como a operação é rápida, o usuário consegue clicar 3 vezes antes do primeiro completar. Além disso, não há proteção server-side contra dispatches duplicados.

## Correções propostas

### 1. Proteger o botão contra cliques múltiplos (UI)
- Adicionar estado `isStarting` que fica `true` desde o primeiro clique até o `finally` do handler
- Usar esse estado no `disabled` do botão em vez de apenas `createDispatch.isPending`

### 2. Deduplição no servidor (Edge Function)
- Antes de processar um contato, verificar se o mesmo número já recebeu o mesmo template com sucesso nos últimos 60 minutos
- Se já recebeu, pular (marcar como `skipped`) em vez de enviar novamente

### 3. Prevenir criação de dispatches duplicados (servidor)
- Na criação do dispatch, verificar se já existe um dispatch `running` ou `pending` com o mesmo `meta_template_id` e `channel_id`
- Se existir, rejeitar a criação

### Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/pages/BulkDispatch.tsx` | Adicionar estado `isStarting` para bloquear cliques múltiplos |
| `supabase/functions/process-bulk-dispatch/index.ts` | Deduplição: pular contatos que já receberam o mesmo template recentemente |
| `src/hooks/useBulkDispatch.ts` | Validação na criação: rejeitar se dispatch similar já está rodando |

