
# Plano: Corrigir Layout do Chat Interno para Funcionar em Qualquer Zoom

## Problema Identificado

Analisando a imagem com zoom 100% do Chrome, o Chat Interno apresenta os seguintes problemas:

1. **Área de mensagens não preenche o espaço disponível** - há muito espaço vazio à esquerda
2. **As mensagens ficam deslocadas para a direita** - especialmente as mensagens enviadas (em roxo)
3. **O layout não se adapta corretamente** quando o zoom do navegador muda

### Causa Raiz Técnica

O problema está na combinação de:

1. **`max-w-4xl` (896px) no container de mensagens** - limita muito a área em monitores grandes
2. **Uso de porcentagens para largura máxima das mensagens** (`max-w-[70%]`) - funciona diferente com zoom
3. **Flexbox com `justify-end`** - em containers muito largos, as mensagens vão para o extremo direito

## Solução Proposta

### 1. Remover limitação `max-w-4xl` do container de mensagens

O container de mensagens não precisa de largura máxima fixa - a área deve usar todo o espaço disponível.

**Arquivo: `InternalChatArea.tsx`**

```text
Antes:
<div className="p-4 max-w-4xl mx-auto">

Depois:
<div className="p-4">
```

### 2. Ajustar largura máxima das bolhas de mensagem

Usar largura fixa máxima em pixels para as bolhas, garantindo consistência em qualquer zoom.

**Arquivo: `InternalChatMessageItem.tsx`**

```text
Antes:
<div className="max-w-[70%] sm:max-w-[60%] lg:max-w-md xl:max-w-lg relative flex flex-col ...">

Depois:
<div className="max-w-[min(70%,_480px)] relative flex flex-col ...">
```

A função CSS `min()` garante que a bolha seja no máximo 70% do container OU 480px, o que for menor.

### 3. Adicionar padding lateral proporcional na área de mensagens

Para evitar que as mensagens fiquem coladas nas bordas em telas largas:

**Arquivo: `InternalChatArea.tsx`**

```text
Antes:
<div className="p-4">

Depois:
<div className="p-4 px-4 md:px-6 lg:px-8">
```

### 4. Garantir que o container use altura dinâmica

Usar `dvh` (dynamic viewport height) como fallback para melhor suporte a zoom:

**Arquivo: `InternalChatArea.tsx`**

Adicionar fallback de altura:
```css
min-height: 0;
height: 100%;
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/internal-chat/InternalChatArea.tsx` | Remover `max-w-4xl mx-auto` e ajustar padding |
| `src/components/internal-chat/InternalChatMessageItem.tsx` | Usar `max-w-[min(70%,_480px)]` para bolhas |

---

## Detalhes Técnicos

### Por que o zoom afeta o layout?

Quando o usuário altera o zoom do navegador:
- O viewport em pixels "muda" - 100% zoom em 1920px = 1920px, 110% zoom = ~1745px
- Unidades como `vh` são recalculadas
- Breakpoints de Tailwind (`lg:`, `xl:`) podem mudar
- A combinação de `max-w-4xl` (896px) + `mx-auto` faz o container flutuar no centro, deixando espaço vazio

### Solução CSS com `min()`

```css
max-width: min(70%, 480px);
```

Isso garante:
- Em telas pequenas: máximo de 70% da área
- Em telas grandes: máximo de 480px (largura confortável para leitura)
- Funciona independente do zoom

---

## Resultado Esperado

Após a correção:
1. As mensagens ocuparão toda a largura disponível
2. As bolhas terão tamanho consistente em qualquer zoom
3. O layout será responsivo e adaptável
4. Sem espaços vazios desnecessários à esquerda ou direita

---

## Testes Recomendados

Após implementar, testar em:
1. Chrome zoom 100%, 110%, 125%, 150%
2. Diferentes resoluções de tela (1366x768, 1920x1080, 2560x1440)
3. Redimensionar janela do navegador
4. Verificar no Firefox e Edge também
