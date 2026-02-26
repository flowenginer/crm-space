
# Corrigir status de entrega (dois tracinhos) para UAZAPI no tenant Master

## Problema Identificado

Analisei os logs do webhook e encontrei a causa raiz. O UAZAPI envia eventos de status de entrega no seguinte formato:

```text
EventType: "messages_update"   (campo no root do payload, com E maiusculo)
type: "ReadReceipt"
event: { ... objeto com MessageIDs, Type: "Delivered" }
```

A funcao `isMessageStatusEvent` no webhook verifica os seguintes valores para UAZAPI:

- `payload.event` como string (mas nesse formato, `event` eh um OBJETO, nao string) -> resultado: `""`
- `payload.EventType` contra: `"message_ack"`, `"ack"`, `"messages_ack"`, `"message-ack"`

Porem, o valor real eh `"messages_update"` — que **NAO esta na lista de verificacao do `uazapiEventType`**. Ele so eh verificado em `uazapiEvent` (que espera `payload.event` como string `"messages.update"`), mas nesse formato do payload, `payload.event` eh um objeto.

Resultado: o evento de status cai no `isMessageEvent` check, que retorna `false`, e o evento eh descartado com "Not a message event, skipping". Os logs confirmam:

```text
Event NOT processed as message - RawEvent: "ReadReceipt", UAZAPIEventType: "messages_update", IsMessageEvent: false
```

No tenant da Space funciona porque provavelmente usa um formato diferente de payload (formato antigo com `event` como string ou ack inline na mensagem).

## Solucao

Adicionar `"messages_update"` a lista de verificacao do `uazapiEventType` na funcao `isMessageStatusEvent`.

Tambem preciso garantir que a funcao `extractStatusUpdates` consiga extrair os IDs de mensagem do formato UAZAPI V2 com `event.MessageIDs`.

## Alteracoes

### 1. `supabase/functions/whatsapp-webhook/index.ts` — funcao `isMessageStatusEvent`

Adicionar `uazapiEventType === "messages_update"` na condicao de UAZAPI (linha ~4181-4187).

### 2. `supabase/functions/whatsapp-webhook/index.ts` — funcao `extractStatusUpdates`

Adicionar tratamento para o formato UAZAPI V2 onde os dados vem em `payload.event.MessageIDs` com `payload.event.Type` ou `payload.state` indicando o status ("Delivered", "Read", "Played").

### 3. Deploy da edge function

Fazer deploy da funcao `whatsapp-webhook` apos as alteracoes.

## Por que funciona na Space e nao na Master?

Provavelmente a Space usa uma versao/config diferente do UAZAPI que envia o ACK em formato diferente (com `ack` numerico inline na mensagem, ou com `event` como string). A Master usa um formato mais novo do UAZAPI V2 com `EventType: "messages_update"` e `event` como objeto — formato que nao estava coberto pelo codigo.
