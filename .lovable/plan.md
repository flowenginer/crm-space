
# Indicador de Etiquetas na Lista de Conversas

## O que sera feito

Adicionar um pequeno indicador visual (icone de etiqueta com a quantidade) na lista de conversas, mostrando quando um contato possui etiquetas. Sera um badge discreto, similar aos que ja existem (Ads, Segmento, etc).

## Abordagem

Como a lista pode ter milhares de conversas, **nao** vamos carregar o nome/cor de cada etiqueta para cada conversa -- isso seria muito pesado. Em vez disso, vamos buscar apenas a **contagem** de tags por contato, usando uma sub-query no Supabase.

O indicador sera um badge com icone de Tag + numero (ex: "3" se o contato tem 3 etiquetas), posicionado junto aos outros badges (apos Segmento, antes de Reaberta).

## Alteracoes

### 1. `src/hooks/usePaginatedConversations.ts` - Adicionar contagem de tags na query

No `CONVERSATION_FIELDS_DYNAMIC`, adicionar a relacao com `contact_tags` via o contato para trazer a contagem. Porem, o Supabase nao suporta `count` em sub-selects diretamente. Entao a abordagem sera:

**Opcao escolhida**: Fazer uma query separada e leve apos carregar as conversas, buscando a contagem de tags dos contact_ids daquela pagina (batch de 50 contatos por vez). Isso adiciona apenas 1 query extra por pagina.

```typescript
// Apos carregar conversations, buscar tag counts
const contactIds = conversations.map(c => c.contact_id).filter(Boolean);
const { data: tagCounts } = await supabase
  .from('contact_tags')
  .select('contact_id')
  .in('contact_id', contactIds);

// Agrupar contagem por contact_id
const tagCountMap = {};
tagCounts?.forEach(tc => {
  tagCountMap[tc.contact_id] = (tagCountMap[tc.contact_id] || 0) + 1;
});

// Adicionar tag_count a cada conversa
conversations.forEach(c => {
  c.tag_count = tagCountMap[c.contact_id] || 0;
});
```

### 2. `src/hooks/useConversations.ts` - Atualizar interface

Adicionar `tag_count?: number` na interface `Conversation`.

### 3. `src/pages/Conversations.tsx` - Exibir badge de etiqueta no ConversationItem

Adicionar um badge entre o Segmento e o Reaberta:

```
{conversation.tag_count > 0 && (
  <div className="flex items-center gap-1 px-2 py-0.5 bg-orange-500/20 rounded-full">
    <Tag size={10} className="text-orange-600" />
    <span className="text-xs text-orange-600 font-medium">
      {conversation.tag_count}
    </span>
  </div>
)}
```

O badge tera cor laranja para se diferenciar dos demais e sera discreto (mesmo estilo dos badges existentes).

## Complexidade

**Baixa**. Sao apenas 3 alteracoes pontuais:
- 1 campo na interface
- 1 query extra (leve, apenas contact_id) no carregamento paginado
- 1 badge visual no componente de item

Nenhuma migracao de banco necessaria.
