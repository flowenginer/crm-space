
# Correção: Conflito de Funções Duplicadas no Relatório de Atendimentos

## Diagnóstico

Após investigação no banco de dados, foram encontradas **duas versões da função `search_conversations_report` registradas simultaneamente**:

| OID | Versão | Tipos de parâmetro |
|-----|--------|-------------------|
| 511461 | Antiga | `timestamp with time zone`, `uuid[]` (original) |
| 511494 | Nova | `text`, `text[]` (criada pela última migration) |

O `DROP FUNCTION` na migration mais recente usou a assinatura `text[]`, mas a função original usa `uuid[]` e `timestamp with time zone` — então o DROP **não removeu a função antiga**. Com duas funções de mesmo nome, o PostgreSQL retorna erro de ambiguidade e o relatório fica em branco.

---

## Solução

Uma única migration SQL que:

1. **Remove as DUAS versões** da função, usando os tipos corretos de cada assinatura para garantir que ambas sejam dropadas sem ambiguidade.
2. **Recria a função** com a versão mais recente (com `internal_notes_text`, `sent_messages_count`, `received_messages_count`, `contact_lead_score`, `first_response_at`, `total_active_time_seconds`) — usando assinatura `text` para todos os parâmetros.
3. **Notifica o PostgREST** para recarregar o schema cache com `NOTIFY pgrst, 'reload schema'`.

### SQL da migration (resumo):

```sql
-- Remove a versão antiga (com uuid[] e timestamptz)
DROP FUNCTION IF EXISTS public.search_conversations_report(
  timestamp with time zone, timestamp with time zone, text, text,
  text[], uuid[], text[], text[], uuid[], text[], integer, integer
);

-- Remove a versão nova (com text[])
DROP FUNCTION IF EXISTS public.search_conversations_report(
  text, text, text, text,
  text[], text[], text[], text[], text[], text[], integer, integer
);

-- Recria com a versão completa e correta
CREATE OR REPLACE FUNCTION public.search_conversations_report(...)
...

-- Recarrega o schema cache do PostgREST
NOTIFY pgrst, 'reload schema';
```

---

## Arquivos Afetados

1. **Nova migration SQL** — faz o DROP correto das duas versões e recria a função uma única vez limpa.
2. **Nenhuma alteração no frontend** — o `ConversationReport.tsx` já está correto chamando com parâmetros `text`.

---

## Resultado Esperado

Após aplicar a migration, o relatório voltará a carregar normalmente com todas as colunas existentes mais a nova coluna "Notas Internas".
