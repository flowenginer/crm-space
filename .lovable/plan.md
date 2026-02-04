
# Plano: Tornar o Chat Interno Responsivo para Telas Widescreen

## Problema Identificado

Em telas grandes/widescreen, as mensagens enviadas pelo remetente (você) desaparecem ou ficam fora da área visível. Isso acontece porque:

1. A área de mensagens não tem largura máxima - em telas muito largas, ela se expande infinitamente
2. As mensagens do remetente ficam alinhadas à direita com `justify-end`, mas o container é tão largo que elas "somem" do campo de visão
3. Os botões de ação (responder/apagar) usam posicionamento absoluto que pode sair da área visível

## Solução Proposta

### 1. Limitar a largura máxima da área de mensagens

Adicionar um container centralizado com largura máxima para garantir que as mensagens fiquem sempre visíveis, independente do tamanho da tela.

**Arquivo: `InternalChatArea.tsx`**
```tsx
{/* Messages Area */}
<ScrollArea className="flex-1 min-h-0">
  <div className="p-4 max-w-4xl mx-auto">  {/* Adicionado max-w-4xl mx-auto */}
    {/* conteúdo das mensagens */}
  </div>
</ScrollArea>
```

### 2. Ajustar o posicionamento das mensagens do remetente

Garantir que as mensagens fiquem contidas dentro da área visível com padding responsivo.

**Arquivo: `InternalChatMessageItem.tsx`**
```tsx
<div className={cn(
  'flex gap-2 group',
  isFromMe ? 'justify-end' : 'justify-start'  // Remover pr-4 e pl-2 fixos
)}>
```

### 3. Limitar largura máxima das bolhas de mensagem

Usar largura máxima absoluta além do percentual para evitar bolhas muito largas.

**Arquivo: `InternalChatMessageItem.tsx`**
```tsx
<div className={cn(
  'max-w-[70%] sm:max-w-[60%] lg:max-w-md xl:max-w-lg relative',
  // max-w-md = 448px, max-w-lg = 512px (valores fixos para telas grandes)
  isFromMe ? 'items-end' : 'items-start'
)}>
```

### 4. Ajustar posição dos botões de ação

Mover os botões para dentro do container da mensagem para não ficarem cortados.

**Arquivo: `InternalChatMessageItem.tsx`**
```tsx
{/* Action buttons - dentro do container, não absoluto fora */}
<div className={cn(
  'flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity mt-1',
  isFromMe ? 'justify-end' : 'justify-start'
)}>
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/internal-chat/InternalChatArea.tsx` | Adicionar `max-w-4xl mx-auto` no container de mensagens |
| `src/components/internal-chat/InternalChatMessageItem.tsx` | Ajustar larguras máximas responsivas e posicionamento dos botões de ação |

---

## Benefícios

1. **Visibilidade garantida**: Mensagens sempre visíveis em qualquer tamanho de tela
2. **Experiência consistente**: Layout similar ao WhatsApp/Telegram em telas grandes
3. **Botões acessíveis**: Ações de responder/apagar sempre dentro da área visível
4. **Responsividade gradual**: Funciona bem desde mobile até ultrawide

---

## Validação

Após implementar, teste em:
1. Tela normal (1920x1080)
2. Tela widescreen/ultrawide (2560px+)
3. Redimensionar a janela do navegador
4. Verificar se as mensagens enviadas aparecem corretamente
5. Confirmar que os botões de ação (responder/apagar) funcionam
