

# Drag & Drop para Reorganizar Etiquetas

## O que sera feito

Adicionar a funcionalidade de arrastar e soltar (drag & drop) nos cards de etiquetas na pagina de configuracoes, permitindo reorganizar a ordem visualmente. A nova ordem sera salva no banco de dados.

## Alteracoes

### 1. Migracao de banco: adicionar coluna `order_position` na tabela `tags`

A tabela `tags` nao possui coluna de ordenacao. Sera adicionada:

```sql
ALTER TABLE tags ADD COLUMN order_position integer DEFAULT 0;
-- Preencher posicoes iniciais baseadas na ordem alfabetica atual
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY name) as rn
  FROM tags
)
UPDATE tags SET order_position = ranked.rn FROM ranked WHERE tags.id = ranked.id;
```

### 2. `src/hooks/useTags.ts` - Atualizar queries e adicionar mutation de reordenacao

- Alterar `.order('name')` para `.order('order_position')` nas queries `useTags` e `useAllTags`
- Adicionar `order_position` na interface `Tag`
- Criar hook `useReorderTags` que recebe um array de `{ id, order_position }` e faz update em batch

### 3. `src/components/settings/TagManagement.tsx` - Adicionar drag & drop com @dnd-kit

O projeto ja usa `@dnd-kit/core` e `@dnd-kit/sortable` em varios locais (MenuConfiguration, Attributes, DashboardGrid). Seguiremos o mesmo padrao:

- Importar `DndContext`, `closestCenter`, `useSensors`, `PointerSensor`, `KeyboardSensor` de `@dnd-kit/core`
- Importar `SortableContext`, `rectSortingStrategy`, `arrayMove`, `useSortable` de `@dnd-kit/sortable`
- Criar componente `SortableTagCard` que encapsula cada card com `useSortable`, adicionando um icone de "grip" (arrastar) visivel no hover
- Envolver o grid com `DndContext` + `SortableContext`
- No `onDragEnd`, chamar `arrayMove` para reordenar localmente e `useReorderTags` para persistir

O drag & drop so sera ativo quando **nao** houver filtro de busca ativo (para evitar confusao ao arrastar itens filtrados).

### Detalhes visuais

- Icone `GripVertical` aparece no canto superior esquerdo de cada card (visivel no hover)
- Durante o arraste, o card tera uma leve sombra/opacidade para feedback visual
- Layout em grid sera mantido (4 colunas em telas grandes)
- Quando houver busca ativa, o grip fica oculto e o drag desabilitado

## Complexidade

**Media**. Envolve:
- 1 migracao de banco (simples)
- Ajuste em 2 arquivos existentes
- Reutiliza padrao ja consolidado no projeto (@dnd-kit)
