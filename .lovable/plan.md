

# Corrigir Disparo em Massa com Templates de Header Mídia

## Problema Identificado

Existem **duas falhas** que causam o erro #132012:

1. **Mapeamento de variáveis quebrado**: A UI salva variáveis como `{{1}}`, `{{2}}`, mas a edge function filtra por prefixos `header_*` e `body_*` — resultado: nenhuma variável é encontrada, o payload vai sem componentes.

2. **UI não permite inserir URL de mídia**: O `MetaTemplateSelector` só mostra inputs de texto para variáveis `{{N}}`. Quando o template tem header IMAGE/VIDEO/DOCUMENT, não existe campo para fornecer a URL da mídia.

## Plano de Correção

### 1. Corrigir a edge function `process-bulk-dispatch/index.ts` — remapear variáveis

Na função `sendMetaTemplateMessage`, trocar a lógica de filtragem por prefixo para interpretar corretamente as variáveis vindas da UI:

- Se `processedVariables` contém chaves com prefixo `header_`/`body_` → usar como está (compatibilidade)
- Se contém chaves no formato `{{N}}` → mapear automaticamente usando os `components` do template:
  - Contar quantas variáveis pertencem ao HEADER (via regex no texto do header)
  - As primeiras N variáveis vão para header, as restantes para body
- Se existir chave especial `header_media_url` → usar como URL de mídia do header

### 2. Atualizar `MetaTemplateSelector` — adicionar input de mídia para headers

- Detectar se o template selecionado tem header com `format: IMAGE | VIDEO | DOCUMENT`
- Quando for mídia: mostrar um campo de URL (ou upload) para a mídia do header, salvando como `header_media_url` nas variáveis
- Quando for TEXT com variáveis: manter comportamento atual
- Separar visualmente as variáveis por componente (Header / Body)

### 3. Atualizar `extractTemplateVariables` em `useMetaTemplates.ts`

- Retornar informação mais rica: quantidade de variáveis por componente (header vs body) e o formato do header
- Isso permite ao `MetaTemplateSelector` saber quais inputs renderizar

### Arquivos Modificados

| Arquivo | Alteração |
|---|---|
| `supabase/functions/process-bulk-dispatch/index.ts` | Remapear variáveis `{{N}}` → `header_`/`body_` + usar `header_media_url` |
| `src/components/meta-templates/MetaTemplateSelector.tsx` | Adicionar campo de URL de mídia para headers IMAGE/VIDEO/DOCUMENT; separar variáveis por componente |
| `src/hooks/useMetaTemplates.ts` | Criar helper `extractDetailedVariables()` que retorna info por componente |

### Detalhes Técnicos

**Edge function — lógica de remapeamento:**
```text
Se variáveis têm formato {{N}}:
  1. Ler components do template
  2. Contar vars no HEADER text → headerVarCount
  3. {{1}}..{{headerVarCount}} → header_1..header_N
  4. {{headerVarCount+1}}.. → body_1..body_N
  
Se existe header_media_url:
  → Usar como link de mídia (image/video/document)
```

**MetaTemplateSelector — novo campo de mídia:**
- Quando `headerComponent.format` é IMAGE/VIDEO/DOCUMENT, renderizar um input de URL com label "URL da imagem/vídeo/documento do cabeçalho"
- O valor é salvo como `header_media_url` no objeto de variáveis

