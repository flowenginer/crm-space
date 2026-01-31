
# Adicionar Filtro de Motivo de Fechamento no Disparo em Massa

## Resumo

Você quer disparar mensagens para clientes cujas conversas foram fechadas por um **motivo específico** (ex: "Queria menos de 10" - quantidade não atingida). Atualmente esse filtro não existe na página de Disparo em Massa.

A implementação será feita de forma **aditiva**, sem alterar nada do que já funciona.

---

## O Que Será Adicionado

| Local | Alteração |
|-------|-----------|
| Interface de Filtros | Novo campo "Motivo de Fechamento" com multi-select |
| Hook `useBulkDispatch.ts` | Novo campo `closeReasonIds` na interface de filtros |
| Funções RPC no banco | Novo parâmetro `p_close_reason_ids` nas funções de preview |
| Edge Function | Suporte ao novo filtro na geração de contatos |

---

## Detalhes da Implementação

### 1. Atualizar Interface de Filtros

```text
Localização: src/hooks/useBulkDispatch.ts

Adicionar à interface BulkDispatchFilters:
  closeReasonIds?: string[];  // IDs dos motivos de fechamento
```

### 2. Adicionar UI do Filtro

```text
Localização: src/pages/BulkDispatch.tsx

Posição: Logo abaixo do filtro de Departamento (linha ~480)

Novo bloco:
  ┌──────────────────────────────────────────────┐
  │ Motivo de Fechamento                         │
  │ [▼ Selecione os motivos                    ] │
  │   ☑ Queria menos de 10                       │
  │   ☐ Achou caro                               │
  │   ☐ Sem interesse                            │
  │   ☐ Contato futuro                           │
  │   ...                                        │
  └──────────────────────────────────────────────┘
```

**Nota**: Este filtro só faz sentido quando combinado com `conversationStatus = closed`.

### 3. Atualizar Mapeamento para RPC

```text
Localização: src/hooks/useBulkDispatch.ts - função prepareRpcParams()

Adicionar:
  p_close_reason_ids: filters.closeReasonIds?.length ? filters.closeReasonIds : null,
```

### 4. Atualizar Funções RPC no Banco

Duas funções precisam ser alteradas para aceitar o novo parâmetro:

```sql
-- get_bulk_dispatch_preview_count
-- get_bulk_dispatch_preview_contacts

-- Adicionar parâmetro:
p_close_reason_ids UUID[] DEFAULT NULL

-- Adicionar filtro (a coluna close_reason armazena o NOME, 
-- então precisamos fazer JOIN com close_reasons):
AND (p_close_reason_ids IS NULL OR EXISTS (
  SELECT 1 FROM conversations conv
  JOIN close_reasons cr ON cr.name = conv.close_reason AND cr.tenant_id = conv.tenant_id
  WHERE conv.contact_id = c.id 
    AND cr.id = ANY(p_close_reason_ids)
))
```

### 5. Buscar Motivos de Fechamento

```text
Localização: src/pages/BulkDispatch.tsx

Adicionar query para buscar close_reasons:
  const { data: closeReasons = [] } = useQuery({
    queryKey: ['close-reasons'],
    queryFn: async () => {
      const { data } = await supabase.from('close_reasons').select('id, name').order('name');
      return data || [];
    }
  });

Transformar em options:
  const closeReasonOptions = closeReasons.map(cr => ({ value: cr.id, label: cr.name }));
```

---

## Fluxo Esperado

```text
1. Usuário acessa Disparo em Massa
2. Seleciona "Motivo de Fechamento" → "Queria menos de 10"
3. Sistema automaticamente assume que quer conversas fechadas
4. Preview mostra apenas contatos com esse motivo
5. Disparo é enviado para esse público específico

Motivos disponíveis no tenant:
• Achou caro
• Contato futuro
• Duplicado
• Número errado
• Outro motivo
• Queria menos de 10  ← O que você quer usar agora
• Sem interesse
• Spam
• Venda realizada
```

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/hooks/useBulkDispatch.ts` | Adicionar campo `closeReasonIds` à interface + mapeamento RPC |
| `src/pages/BulkDispatch.tsx` | Adicionar query de close_reasons + componente MultiSelect |
| Migração SQL | Alterar 2 funções RPC para aceitar novo parâmetro |
| `supabase/functions/process-bulk-dispatch/index.ts` | Suporte ao filtro na geração server-side |

---

## Seção Técnica - SQL das Funções RPC

```sql
-- Alteração em get_bulk_dispatch_preview_count
CREATE OR REPLACE FUNCTION get_bulk_dispatch_preview_count(
  p_tenant_id UUID,
  p_lead_status_names TEXT[] DEFAULT NULL,
  p_last_client_message_days_ago INT DEFAULT NULL,
  p_tag_ids UUID[] DEFAULT NULL,
  p_conversation_statuses TEXT[] DEFAULT NULL,
  p_segment_id UUID DEFAULT NULL,
  p_origin TEXT DEFAULT NULL,
  p_assigned_to UUID[] DEFAULT NULL,
  p_department_ids UUID[] DEFAULT NULL,
  p_contact_type TEXT DEFAULT NULL,
  p_include_blocked BOOLEAN DEFAULT FALSE,
  p_first_contact_start TIMESTAMP DEFAULT NULL,
  p_first_contact_end TIMESTAMP DEFAULT NULL,
  p_close_reason_ids UUID[] DEFAULT NULL  -- NOVO
)
RETURNS BIGINT AS $$
  SELECT COUNT(DISTINCT c.id)
  FROM contacts c
  WHERE c.tenant_id = p_tenant_id
    -- ... filtros existentes ...
    -- Filtro de motivo de fechamento (NOVO)
    AND (p_close_reason_ids IS NULL OR EXISTS (
      SELECT 1 FROM conversations conv
      JOIN close_reasons cr ON cr.name = conv.close_reason AND cr.tenant_id = conv.tenant_id
      WHERE conv.contact_id = c.id 
        AND cr.id = ANY(p_close_reason_ids)
    ))
$$ LANGUAGE SQL STABLE;
```

---

## Impacto Zero em Funcionalidades Existentes

- Filtros existentes continuam funcionando normalmente
- Novo parâmetro tem `DEFAULT NULL` (não afeta chamadas antigas)
- UI adiciona campo sem remover nenhum outro
- Edge function mantém lógica original, apenas adiciona verificação extra
