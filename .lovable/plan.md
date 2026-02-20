
# Adicionar Coluna "Notas Internas" ao Relatório de Atendimentos

## Contexto

A tabela `internal_notes` existe e possui os campos: `id`, `conversation_id`, `author_id`, `content`, `is_pinned`, `created_at`, `tenant_id`. Cada conversa pode ter **várias** notas internas. O relatório precisa exibir/exportar essas notas como uma coluna adicional.

A estratégia é concatenar todas as notas de cada conversa em um único campo de texto, separadas por um delimitador claro, para que caibam em uma única célula do Excel.

---

## Decisão de Design

Como uma conversa pode ter múltiplas notas internas, existem duas abordagens:

**Opção A (escolhida):** Concatenar todas as notas em uma única célula, separadas por `" | "`.
Exemplo: `"Cliente quer desconto | Ligue amanhã cedo | Verificar contrato"`

Isso mantém o formato do Excel simples (uma linha por atendimento) e é compatível com o configurador de colunas existente.

---

## Mudanças Técnicas

### 1. Migration SQL — Atualizar `search_conversations_report`

O RPC precisa de um novo campo de retorno: `internal_notes_text text`.

Adicionar uma nova CTE `internal_notes_agg` que agrega as notas de cada conversa via `STRING_AGG`:

```sql
-- Novo campo no RETURNS TABLE:
internal_notes_text text

-- Nova CTE:
internal_notes_agg AS (
  SELECT
    conversation_id,
    STRING_AGG(content, ' | ' ORDER BY created_at ASC) as notes_text
  FROM internal_notes
  WHERE conversation_id IN (SELECT id FROM base_conversations)
  GROUP BY conversation_id
)

-- No SELECT final:
LEFT JOIN internal_notes_agg ina ON ina.conversation_id = bc.id
-- Campo retornado:
COALESCE(ina.notes_text, '') as internal_notes_text
```

> A migration irá fazer DROP da função atual e recriar com o novo campo, mantendo todos os campos existentes intactos.

### 2. Frontend — `src/pages/ConversationReport.tsx`

**a) Nova coluna em `DEFAULT_COLUMNS`:**
```typescript
{ key: 'internal_notes', label: 'Notas Internas', enabled: false },
```
Chega como `enabled: false` por padrão — não quebra usuários existentes.

**b) Novo case em `getFieldValue`:**
```typescript
case 'internal_notes': return conv.internal_notes_text || '-';
```

**c) Mapeamento no `queryFn`** (tanto na query principal quanto no export de todas as páginas):
```typescript
internal_notes_text: row.internal_notes_text || '',
```

---

## Fluxo no Excel

Quando habilitada, a coluna "Notas Internas" aparece no `.xlsx` como uma célula de texto com todas as notas concatenadas. Se não houver notas, a célula mostrará vazio.

Exemplo de saída:
| # | Nome | Status Conversa | Notas Internas |
|---|------|----------------|----------------|
| AB123C | João Silva | Fechado | Cliente pediu retorno | Confirmado via WhatsApp |
| DE456F | Maria Souza | Ativo | *(vazio)* |

---

## Arquivos a Modificar

1. **Nova migration SQL** — adiciona `internal_notes_text` ao RPC `search_conversations_report` via nova CTE com `STRING_AGG`.
2. **`src/pages/ConversationReport.tsx`** — adiciona coluna ao configurador + `getFieldValue` + mapeamento nos dois lugares onde os dados são mapeados (query principal e export full-page).

---

## Compatibilidade

- A nova coluna chega com `enabled: false` — nenhum usuário existente verá mudança até habilitar manualmente no configurador de colunas.
- O RPC mantém todos os 25 campos existentes; o novo é adicionado como 26º.
- Sem impacto em performance significativo: a CTE usa `IN (SELECT id FROM base_conversations)` para limitar o escopo às conversas já filtradas.
