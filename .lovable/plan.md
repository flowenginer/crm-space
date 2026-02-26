

# Corrigir Scroll e Icones Cortados no Popover de Atalhos Rapidos

## Problemas Identificados

1. **Scroll do mouse nao funciona**: O `PopoverContent` tem `overflow-hidden` que bloqueia a propagacao do scroll do mouse para o `ScrollArea` interno.

2. **Icones de editar/enviar cortados**: Em telas menores ou resolucoes especificas, a largura fixa de `580px` do popover faz com que os icones do lado direito (lapis e aviaozinho) sejam cortados pela borda da viewport.

## Solucao

### 1. Corrigir o scroll
- Trocar `overflow-hidden` por `overflow-visible` no PopoverContent (ou remover), e garantir que o ScrollArea tenha controle total do overflow interno.
- Alternativamente, manter `overflow-hidden` apenas no eixo horizontal e permitir o scroll vertical via ScrollArea.

### 2. Corrigir icones cortados
- Trocar a largura fixa `w-[580px]` por uma largura responsiva com `max-w` baseado em viewport: `w-[580px] max-w-[calc(100vw-32px)]`.
- Isso garante que em telas menores o popover se adapta sem cortar o conteudo.

## Arquivo Alterado
- `src/components/conversations/QuickTemplatesPopover.tsx`

## Mudancas Especificas

**Linha 628** - PopoverContent className:
```
De: "w-[580px] p-0 max-h-[min(600px,70vh)] overflow-hidden flex flex-col"
Para: "w-[580px] max-w-[calc(100vw-32px)] p-0 max-h-[min(600px,70vh)] flex flex-col overflow-y-auto overflow-x-hidden"
```

**Linha 379** - ScrollArea: remover a restricao de `max-h` fixa e usar `overflow-y-auto` nativo ao inves do ScrollArea que pode estar bloqueando eventos de roda do mouse, ou trocar `type="always"` para `type="scroll"` para garantir interatividade do scroll.

A abordagem mais segura e substituir o `ScrollArea` por uma `div` com `overflow-y-auto` nativo do navegador, que sempre funciona com a roda do mouse, e manter o estilo visual com uma scrollbar customizada via CSS.

