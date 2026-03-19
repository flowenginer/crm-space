

# Adicionar suporte a imagem no cabeçalho ao criar template

## Resumo

Atualmente o modal de criação de template (`MetaTemplateModal`) só permite cabeçalho de texto. Vamos adicionar a opção de escolher entre **Texto** ou **Imagem** no header, com upload de imagem via Meta Resumable Upload API.

## Mudanças

### 1. `src/components/meta-templates/MetaTemplateModal.tsx`

- Adicionar um seletor de **tipo de cabeçalho**: `Nenhum`, `Texto`, `Imagem`
- Quando "Imagem" selecionado:
  - Mostrar input de upload de arquivo (aceitar `.jpg`, `.png`)
  - Mostrar estado de upload (loading, sucesso)
  - Armazenar o `header_handle` retornado pela Meta após upload
- Quando "Texto" selecionado: manter o comportamento atual (input de texto)
- No `handleSubmit`: montar o componente HEADER com `format: 'IMAGE'` e `example.header_handle: [handle]` quando imagem selecionada
- Adicionar estado: `headerType` (`none` | `text` | `image`), `headerImageFile`, `headerImageHandle`, `isUploadingImage`

### 2. `supabase/functions/meta-create-template/index.ts`

- Nenhuma mudança necessária — a edge function já repassa os `components` diretamente para a Meta API, incluindo `format: 'IMAGE'` e `example.header_handle`

### 3. Nova edge function: `supabase/functions/meta-upload-media/index.ts`

- Endpoint para fazer upload de imagem via **Meta Resumable Upload API**:
  1. Criar sessão de upload: `POST /{app-id}/uploads` com `file_length`, `file_type`, `access_token`
  2. Enviar arquivo: `POST` para a URL da sessão com o binário
  3. Retornar o `h:` handle para uso no template
- Autenticação: validar JWT do Supabase, buscar `access_token` e `app_id` da `cloudapi_configs`

### 4. `src/hooks/useMetaTemplates.ts`

- Adicionar hook `useUploadMetaMedia` que chama a nova edge function com o arquivo e retorna o handle

## Fluxo do usuário

```text
Tipo de Cabeçalho: [Nenhum ▼] [Texto ▼] [Imagem ▼]

Se "Imagem":
  ┌─────────────────────────────────┐
  │  📎 Selecionar imagem           │
  │  Formatos: JPG, PNG (máx 5MB)  │
  │  [Fazendo upload... ⏳]         │
  │  ✅ Imagem carregada            │
  └─────────────────────────────────┘
```

## Arquivos modificados/criados

| Arquivo | Ação |
|---|---|
| `src/components/meta-templates/MetaTemplateModal.tsx` | Modificar — adicionar seletor de tipo de header e upload de imagem |
| `src/hooks/useMetaTemplates.ts` | Modificar — adicionar hook `useUploadMetaMedia` |
| `supabase/functions/meta-upload-media/index.ts` | Criar — edge function para upload via Meta Resumable Upload API |

