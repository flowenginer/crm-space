
# Plano: Corrigir Visualização de Imagens Enviadas no Chat Interno

## Problema Identificado

Quando você envia uma imagem no chat interno:
- **Quem recebe** consegue ver a imagem normalmente
- **Você (quem enviou)** não consegue ver nem clicar para preview

## Diagnóstico

Após analisar o código do `InternalChatMessageItem.tsx`, identifiquei os seguintes pontos que podem causar o problema:

1. **A imagem está dentro da bolha colorida (`bg-primary`)** - isso pode fazer a imagem ficar "escondida" ou com contraste ruim

2. **Falta de estilos essenciais na imagem:**
   - Não tem `display: block` (pode causar espaço extra)
   - Não tem `object-fit` (pode distorcer a imagem)
   - Não tem tratamento especial para mensagens do próprio usuário

3. **Possível problema de carregamento assíncrono:**
   - A imagem pode não estar carregando corretamente para o próprio remetente

## Solução Proposta

### 1. Melhorar renderização de imagem para mensagens próprias

Vou ajustar o componente `InternalChatMessageItem.tsx` para:

```tsx
case 'image':
  return (
    <div className="space-y-2">
      {message.media_url ? (
        <img 
          src={message.media_url} 
          alt={message.media_name || 'Imagem'}
          className={cn(
            "max-w-[300px] max-h-[400px] rounded-lg cursor-pointer",
            "hover:opacity-90 transition-opacity",
            "object-contain block",
            // Ajuste de borda para melhor visibilidade na bolha primária
            isFromMe && "ring-1 ring-white/20"
          )}
          onClick={() => window.open(message.media_url!, '_blank')}
          loading="lazy"
          onError={(e) => {
            console.error('[InternalChat] Image failed to load:', message.media_url);
            e.currentTarget.style.display = 'none';
          }}
        />
      ) : (
        <div className="flex items-center justify-center w-32 h-32 bg-muted rounded-lg">
          <Image className="h-8 w-8 text-muted-foreground animate-pulse" />
        </div>
      )}
      {message.content && (
        <p className={cn(
          "text-sm",
          isFromMe && "text-primary-foreground"
        )}>{message.content}</p>
      )}
    </div>
  );
```

### 2. Adicionar tratamento de erro e loading

- **`loading="lazy"`**: Carregamento otimizado
- **`onError`**: Logar erros de carregamento para debug
- **Fallback visual**: Mostrar placeholder enquanto a imagem não tem URL

### 3. Remover padding excessivo da bolha para mídias

Para imagens, vídeos e documentos, remover o padding da bolha para evitar espaçamento feio:

```tsx
<div className={cn(
  'rounded-2xl overflow-hidden',
  // Para mídias, usar menos padding
  ['image', 'video'].includes(message.message_type) 
    ? 'p-1' 
    : 'px-4 py-2',
  isFromMe 
    ? 'bg-primary text-primary-foreground rounded-br-md' 
    : 'bg-muted rounded-bl-md'
)}>
```

### 4. Adicionar lightbox/preview modal (melhoria adicional)

Criar um preview inline ao invés de abrir em nova aba:
- Dialog/modal para visualizar a imagem em tamanho maior
- Mais intuitivo e não perde contexto da conversa

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/internal-chat/InternalChatMessageItem.tsx` | Melhorar renderização de imagens com tratamento de erro, fallback e estilos específicos para `isFromMe` |

---

## Benefícios

1. **Visibilidade garantida**: Imagens serão visíveis tanto para quem envia quanto para quem recebe
2. **Feedback visual**: Placeholder enquanto a imagem carrega
3. **Debug facilitado**: Logs de erro se a imagem falhar ao carregar
4. **UX melhorada**: Melhor apresentação visual com bordas e overflow controlado

---

## Validação

Após implementar, teste:
1. Enviar uma imagem no chat interno
2. Verificar se você (remetente) consegue ver a imagem
3. Clicar na imagem para abrir preview
4. Confirmar que o destinatário também vê normalmente
