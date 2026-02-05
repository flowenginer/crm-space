
# Ajuste de Tamanho do Popover de Mensagens Rápidas

## Problema Identificado

O popover de "Atalhos Rápidos" está cortando as opções de templates porque:

1. A altura máxima do popover é `max-h-[500px]`
2. A área de scroll interna tem altura fixa de `h-[300px]`
3. Com todos os elementos (cabeçalho, abas, favoritos, busca), sobra pouco espaço para a lista

## Solução

Aumentar as dimensões do popover e da área de scroll para acomodar melhor o conteúdo.

## Alterações

| Local | Antes | Depois |
|-------|-------|--------|
| PopoverContent max-height | `max-h-[500px]` | `max-h-[600px]` |
| ScrollArea height | `h-[300px]` | `h-[380px]` |
| SheetContent mobile height | `h-[70vh]` | `h-[80vh]` |

## Arquivo Afetado

- `src/components/conversations/QuickTemplatesPopover.tsx`

## Detalhes Técnicos

```text
Linha 379: ScrollArea className="h-[300px]" → h-[380px]
Linha 583: SheetContent h-[70vh] → h-[80vh] (mobile)
Linha 628: PopoverContent max-h-[500px] → max-h-[600px]
```

Isso adicionará aproximadamente 100px de espaço vertical extra para exibir mais templates sem corte.
