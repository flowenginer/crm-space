

# Corrigir Limite de Exibicao de Etiquetas no Popover

## Problema Identificado

O popover de "Adicionar Etiqueta" na conversa com o lead possui um `.slice(0, 15)` hardcoded que **limita a exibicao a apenas 15 etiquetas**, independente da quantidade total. Como voces possuem mais de 400 tags no banco, a grande maioria fica oculta.

Esse limite existe em **dois locais** no arquivo `src/pages/Conversations.tsx`:
- Linha 4630: popover do header (desktop)
- Linha 4957: popover do painel lateral

## Solucao

1. **Remover o `.slice(0, 15)`** nos dois popovers, permitindo que todas as etiquetas aparecam na lista com scroll
2. **Aumentar a area de scroll** de `max-h-48` para `max-h-72` (de ~192px para ~288px) para exibir mais tags visiveis sem precisar rolar tanto
3. O campo de busca ja existe, entao o usuario pode filtrar facilmente mesmo com centenas de tags

## Arquivos Alterados

- `src/pages/Conversations.tsx` - remover `.slice(0, 15)` e ajustar `max-h` em 2 locais

## Complexidade

**Muito baixa** - apenas remocao de 2 linhas e ajuste de 2 valores CSS.

