

# Corrigir "Falha ao processar etiquetas" no Bulk Tag

## Problema

A tabela `contact_tags` tem 4 colunas obrigatorias (NOT NULL):
- `contact_id`
- `tag_id`
- `tenant_id`
- `created_at` (tem default)

O codigo em `useBulkAddTag` (arquivo `src/hooks/useBulkConversationActions.ts`) insere apenas `contact_id` e `tag_id`, **sem o `tenant_id`**. O banco de dados rejeita a insercao porque `tenant_id` nao pode ser nulo.

## Solucao

Buscar o `tenant_id` do usuario logado antes do upsert e inclui-lo nos dados de insercao.

## Alteracao

### Arquivo: `src/hooks/useBulkConversationActions.ts` - funcao `useBulkAddTag` (linhas ~453-457)

Antes do upsert, buscar o `tenant_id` do perfil do usuario logado e incluir no array de insercao:

```text
// Antes (atual):
const inserts = contactIds.map(contactId => ({
  contact_id: contactId,
  tag_id: tagId,
}));

// Depois (corrigido):
const { data: { user } } = await supabase.auth.getUser();
const { data: profile } = await supabase
  .from('profiles')
  .select('tenant_id')
  .eq('id', user?.id)
  .single();

const tenantId = profile?.tenant_id;
if (!tenantId) throw new Error('Tenant nao encontrado');

const inserts = contactIds.map(contactId => ({
  contact_id: contactId,
  tag_id: tagId,
  tenant_id: tenantId,
}));
```

Isso resolve o erro sem alterar nenhuma outra funcionalidade.

