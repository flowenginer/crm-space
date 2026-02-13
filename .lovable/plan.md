
# Correção do Timer de Janela 24h — Trigger Perdido no Reset

## Problema Confirmado

O reset do banco de dados removeu o **trigger `trigger_update_last_client_message_at`** da tabela `messages`. A função PostgreSQL ainda existe, mas sem o trigger ela nunca é chamada. Resultado:

- **6 conversas** com `last_client_message_at` completamente NULL (sem timer)
- **4.937 conversas** com timestamp desatualizado (timer mostrando tempo errado)

Os cron jobs estao todos intactos — o problema é exclusivamente o trigger ausente.

## Plano de Correção

### Passo 1: Recriar o trigger

Criar uma migration SQL que:

```text
-- Recriar o trigger perdido no reset
CREATE TRIGGER trigger_update_last_client_message_at
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION update_last_client_message_at();
```

### Passo 2: Backfill dos dados

Na mesma migration, atualizar todas as conversas de canais oficiais com o timestamp correto da ultima mensagem do cliente:

```text
UPDATE conversations c
SET last_client_message_at = (
  SELECT MAX(m.created_at)
  FROM messages m
  WHERE m.conversation_id = c.id
    AND m.is_from_me = false
)
WHERE EXISTS (
  SELECT 1 FROM messages m
  WHERE m.conversation_id = c.id
    AND m.is_from_me = false
);
```

Isso corrige as 4.943 conversas afetadas (6 NULL + 4.937 desatualizadas).

## Resultado Esperado

- Timer de janela 24h volta a funcionar em tempo real para todas as conversas
- Novas mensagens de clientes atualizam o timer automaticamente via trigger
- Nenhuma alteracao de codigo frontend necessaria — o hook `use24hWindow` ja le o campo corretamente
