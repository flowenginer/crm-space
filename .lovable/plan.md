

# Corrigir icones de acao ocultos no popover de Atalhos Rapidos (aba Meta)

## Problema
Na aba "Meta" do popover de Atalhos Rapidos, o icone de envio (aviaozinho) so aparece quando o usuario passa o mouse por cima do item. Em dispositivos moveis ou para usuarios que nao fazem hover, esses icones ficam invisiveis.

A aba de templates normais (Mensagens, Audios, Midias, etc.) ja foi corrigida anteriormente e tem os icones sempre visiveis. Porem a aba "Meta" ainda usa `opacity-0 group-hover:opacity-100`, o que esconde o botao.

## Solucao
Remover a classe `opacity-0 group-hover:opacity-100 transition-opacity` do container de icones na secao de Meta Templates (linha 467 do arquivo `QuickTemplatesPopover.tsx`), deixando os icones permanentemente visiveis, igual ja esta nas outras abas.

## Arquivo alterado
- `src/components/conversations/QuickTemplatesPopover.tsx` - Remover classes de ocultacao no bloco de Meta Templates

