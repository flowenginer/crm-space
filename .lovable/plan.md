

# Fix: Enviar componente header com imagem para templates Meta

## Problema confirmado pelos logs

A Meta **sempre** exige o componente `header` com `type: "image"` + `link` ou `id` para templates com header IMAGE. Omitir o componente causa `Format mismatch, expected IMAGE, received UNKNOWN` (#132012).

A correção anterior (omitir header para "imagem estática") estava incorreta.

## Solução

Para templates com header IMAGE/VIDEO/DOCUMENT sem `header_media_url` fornecida pelo usuário, o sistema precisa:
1. Extrair a URL de exemplo do template (`example.header_handle` no campo `components` do template salvo no banco)
2. Se não houver URL de exemplo disponível, **exigir que o usuário forneça** a URL da mídia antes de enviar

### Abordagem: Exigir URL de mídia na UI

Como os `header_handle` são temporários e expiram, a solução correta é:

1. **Na UI de envio de template** (`Conversations.tsx` e `BulkDispatch`): quando o template tem header IMAGE e não há variáveis de texto no header, mostrar um campo obrigatório para URL da imagem (ou upload)
2. **No backend**: remover a lógica de "skip" e sempre enviar o componente header com a mídia fornecida

### Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/process-bulk-dispatch/index.ts` | Remover lógica de skip; lançar erro se template IMAGE não tiver `header_media_url` |
| `supabase/functions/cloudapi-send-message/index.ts` | Sem mudança (já envia o que recebe) |
| `src/pages/Conversations.tsx` | Quando template tem header IMAGE sem variáveis, exigir URL da imagem no modal |
| `src/components/meta-templates/MetaTemplateUseModal.tsx` | Adicionar campo de upload/URL para mídia do header quando tipo é IMAGE |
| `src/components/meta-templates/MetaTemplateSelector.tsx` | Garantir que campo `header_media_url` aparece para templates com header estático IMAGE |

### Fluxo corrigido

```text
Template com header IMAGE (sem variáveis de texto):
  UI → campo obrigatório "URL da imagem" ou upload
  → envia header_media_url no payload
  → backend monta: { type: "header", parameters: [{ type: "image", image: { link: url } }] }
  → Meta aceita ✅
```

