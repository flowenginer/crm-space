

# Fix: URLs do header_handle da Meta expiram (erro 131053 / 403 Forbidden)

## Problema

Os logs do webhook confirmam o erro:
- **Erro #131053 - "Media upload error"**: `Downloading media from weblink failed with http code 403, status message Forbidden`
- A URL `scontent.whatsapp.net/...` armazenada em `header_handle` do template e **temporaria** e expira apos algumas horas/dias.
- O sistema atual usa essa URL expirada como "automatica", mostrando badge "Automatico" e nao pedindo URL ao usuario.
- A Meta tenta baixar a imagem dessa URL e recebe 403, falhando o envio.

## Solucao

Nao confiar nas URLs do `header_handle` como fonte de midia para envio. Em vez disso:

1. **Ao sincronizar templates**: fazer download da imagem do `header_handle` e re-hospedar no Supabase Storage (bucket publico), salvando a URL permanente no banco.
2. **Alternativa mais simples (recomendada)**: Sempre mostrar o campo de URL de midia para templates com header IMAGE/VIDEO/DOCUMENT, permitindo que o usuario informe uma URL publica permanente, mas pre-preencher com a URL do Storage se disponivel.

### Abordagem escolhida: Upload automatico para Supabase Storage durante sincronizacao

| Arquivo | Mudanca |
|---|---|
| `src/hooks/useMetaTemplates.ts` | Na funcao `extractDetailedVariables`, nao retornar URLs `scontent.whatsapp.net` como `headerMediaUrl` (sao temporarias). Adicionar campo `headerMediaStorageUrl` para URLs hospedadas localmente. |
| `src/components/meta-templates/MetaTemplateSelector.tsx` | Remover badge "Automatico" quando a URL e do WhatsApp CDN. Mostrar campo de URL obrigatorio nesses casos. Permitir override manual. |
| `src/components/meta-templates/MetaTemplateUseModal.tsx` | Mesma logica: mostrar campo de midia quando URL e temporaria. |
| `supabase/functions/sync-meta-templates/index.ts` | Ao sincronizar, baixar a imagem do `header_handle`, salvar no Supabase Storage, e guardar a URL publica permanente em uma nova coluna `header_media_url` na tabela `meta_message_templates`. |
| Migracao SQL | Adicionar coluna `header_media_url TEXT` na tabela `meta_message_templates` para armazenar a URL permanente da midia. |

### Fluxo corrigido

```text
Sincronizacao de templates:
  Meta retorna header_handle (URL temporaria)
  → Edge function baixa a imagem
  → Faz upload para Supabase Storage (bucket publico)
  → Salva URL permanente em meta_message_templates.header_media_url

Envio de template:
  1. Se header_media_url (Storage) existe → usa automaticamente ✅
  2. Se nao existe → mostra campo obrigatorio para usuario informar URL
  3. URL permanente → Meta consegue baixar → envio funciona ✅
```

### Detalhes tecnicos

- A deteccao de URL temporaria sera feita verificando se contem `scontent.whatsapp.net` ou `fbcdn.net`
- O bucket do Storage sera `template-media` com politica publica de leitura
- A migracao e retrocompativel (coluna nullable)

