

# Fix: Template com imagem pré-carregada na Meta não precisa de header component

## Problema

O log mostra:
```
Header media (image): https://scontent.whatsapp.net/v/t61.29466-34/651465729...
```

O sistema está extraindo a URL do `example.header_handle` do template e enviando como `link` no componente header. Essa URL é **temporária** (CDN interno da Meta) e expira — gerando o erro **"Erro ao carregar a mídia"** (11 eventos no painel da Meta).

Para templates com **imagem estática pré-carregada** (sem variáveis no header), a Meta **já usa a imagem automaticamente** — não é necessário enviar o componente header. Enviar uma URL expirada causa rejeição.

## Correção

No `sendMetaTemplateMessage` dentro de `process-bulk-dispatch/index.ts`:

- **Se o usuário forneceu `header_media_url`** → enviar como `link` no componente header (comportamento atual, correto)
- **Se NÃO forneceu `header_media_url` e o header NÃO tem variáveis de texto** → **não enviar componente header** (a Meta usa a mídia do template automaticamente)
- **Remover o fallback para `header_handle`** — essa URL é interna e expira

### Lógica simplificada
```text
Se headerFormat é IMAGE/VIDEO/DOCUMENT:
  Se header_media_url fornecida → enviar componente com link
  Se NÃO fornecida E headerVarCount == 0 → NÃO enviar componente (Meta usa a mídia do template)
  Se NÃO fornecida E headerVarCount > 0 → erro (variável obrigatória)
```

### Arquivo modificado

| Arquivo | Alteração |
|---|---|
| `supabase/functions/process-bulk-dispatch/index.ts` | Remover fallback `header_handle`; não enviar componente header quando mídia é estática |

