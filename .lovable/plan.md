
# Adicionar Origem do Lead no Relatório de Atendimentos

## Situação Atual

A função `search_conversations_report` **não retorna** a origem do lead, por isso ela não aparece no Excel.

### Dados disponíveis no banco:

| Tabela | Coluna | Valores encontrados |
|--------|--------|---------------------|
| `contacts` | `origin` | `meta_ads` (1203), `whatsapp` (591), `manual` (1), NULL (4881) |
| `conversations` | `referral_source` | Fonte de referência da conversa |

## Solução

### 1. Atualizar a função SQL `search_conversations_report`

Adicionar o campo `ct.origin as contact_origin` no retorno da função:

```sql
-- No RETURNS TABLE, adicionar:
contact_origin text,

-- No SELECT, adicionar:
ct.origin as contact_origin,
```

### 2. Atualizar o mapeamento no Frontend

No arquivo `src/pages/ConversationReport.tsx`, na função que processa os dados (linha ~217):

```typescript
contact: {
  full_name: row.contact_full_name,
  phone: row.contact_phone,
  lead_status: row.contact_lead_status,
  origin: row.contact_origin  // ← ADICIONAR
}
```

### 3. Adicionar ao Excel Export

Na função `handleExportExcel` (linha ~357), adicionar a coluna com formatação amigável:

```typescript
'Origem': formatOrigin(conv.contact?.origin),
```

Com função auxiliar para traduzir os valores:
```typescript
const formatOrigin = (origin: string | null) => {
  if (!origin) return 'Não identificado';
  const origins: Record<string, string> = {
    'meta_ads': 'Meta Ads',
    'whatsapp': 'Orgânico (WhatsApp)',
    'manual': 'Manual',
    'import': 'Importação'
  };
  return origins[origin] || origin;
};
```

---

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| Migration SQL | Atualizar função `search_conversations_report` para retornar `ct.origin` |
| `src/pages/ConversationReport.tsx` | 1. Mapear `contact_origin` nos dados<br>2. Adicionar coluna "Origem" no Excel export |

---

## Resultado Esperado

A planilha Excel terá a nova coluna:

| # | Nome | Contato | **Origem** | Status do Lead | Canal | ... |
|---|------|---------|------------|----------------|-------|-----|
| ABC123 | João Silva | +55 11 99999-9999 | **Meta Ads** | Qualificação | WhatsApp Business | ... |
| DEF456 | Maria Santos | +55 21 88888-8888 | **Orgânico (WhatsApp)** | Atendimento | WhatsApp Business | ... |
| GHI789 | Pedro Oliveira | +55 31 77777-7777 | **Não identificado** | New | WhatsApp Business | ... |

---

## Detalhes Técnicos

### Migration SQL completa:

```sql
CREATE OR REPLACE FUNCTION public.search_conversations_report(
  p_start_date timestamp with time zone DEFAULT NULL,
  -- ... parâmetros existentes ...
)
RETURNS TABLE(
  id uuid,
  contact_id uuid,
  -- ... campos existentes ...
  contact_lead_status text,
  contact_origin text,  -- NOVO CAMPO
  channel_name text,
  -- ... resto dos campos ...
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
-- ... lógica existente ...
  RETURN QUERY
  SELECT DISTINCT ON (c.id)
    c.id,
    -- ... campos existentes ...
    ct.lead_status as contact_lead_status,
    ct.origin as contact_origin,  -- NOVO CAMPO
    wc.name as channel_name,
    -- ... resto da query ...
```
