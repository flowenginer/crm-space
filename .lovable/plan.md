

## Plano: Corrigir mensagens duplicadas em canais Instagram

### Diagnóstico confirmado

O banco de dados contém mensagens duplicadas reais (duas rows distintas, timestamps com 3ms de diferença, ambas com `whatsapp_message_id: NULL`). O problema **não é visual** — são inserções duplas no banco.

**Causa raiz**: Existem **múltiplos caminhos de envio** de mensagens no `Conversations.tsx`. O fluxo principal (`handleSendMessage`, linha 3240) foi corrigido para passar `existingMessageId` à edge function, ativando `skipDbInsert=true`. Porém, os fluxos de **templates e respostas rápidas** (linhas ~5698, ~5944, ~6022, ~6034) fazem dupla inserção:

1. `sendMessage.mutate(...)` → insere row no banco (frontend)
2. `sendWhatsAppMessage(...)` → sem `existingMessageId` → edge function `instagram-send-message` recebe `skipDbInsert=false` → insere **outra** row no banco

Para WhatsApp isso não duplica porque a edge function de WhatsApp não insere no banco. Mas a de Instagram sim.

### Correção

#### 1. Unificar todos os caminhos de envio para Instagram (`src/pages/Conversations.tsx`)

Em **todos** os fluxos de template/quick-reply que fazem `sendMessage.mutate` + `sendWhatsAppMessage`:

- Trocar `sendMessage.mutate` por `sendMessage.mutateAsync` para capturar o `savedMessage.id`
- Passar esse ID como `existingMessageId` para `sendWhatsAppMessage`
- Isso ativa `skipDbInsert=true` na edge function, que faz UPDATE em vez de INSERT

**Locais afetados** (5 trechos):
- Linha ~5698: Template simples (onSelectTemplate)
- Linha ~5944: Content blocks — bloco de texto
- Linha ~5960: Content blocks — bloco de mídia
- Linha ~6022: sendTextMessage helper
- Linha ~6034: sendMediaMessage helper

#### 2. Limpar duplicatas existentes no banco (opcional, recomendado)

Executar query SQL para remover rows duplicadas já existentes, mantendo apenas a mais antiga de cada par.

### Arquivos alterados
- `src/pages/Conversations.tsx` — 5 trechos de envio de template/quick-reply

### Resultado esperado
- Templates e respostas rápidas enviados por Instagram criam apenas 1 row no banco
- O fluxo de WhatsApp continua inalterado
- Nenhuma mensagem duplicada no frontend

