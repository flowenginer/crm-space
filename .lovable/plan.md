
# Plano de Correção: Vendedores Não Conseguem Adicionar Contatos

## Resumo do Problema

Vendedores não conseguem criar contatos manualmente. O problema tem **duas causas principais**:

---

## Causa #1: Verificação de Duplicata Bloqueada por RLS

**Localização:** `src/hooks/useContacts.ts` (linhas 144-158, 173-178, 228-234)

### O que acontece:

1. Vendedor tenta criar um contato com telefone X
2. Função `findContactByPhone(X)` é chamada para verificar se já existe
3. O RLS de SELECT só permite ver contatos atribuídos ao próprio vendedor
4. Se o contato X existe mas está atribuído a **outro vendedor**, a função retorna `null`
5. O código tenta inserir o contato
6. INSERT falha com erro de constraint `contacts_phone_tenant_unique` (telefone duplicado)
7. No tratamento de erro, tenta buscar novamente com `findContactByPhone`, mas continua sem encontrar
8. Erro genérico é exibido: "duplicate key value violates unique constraint..."

### Correção Proposta:

Modificar a verificação de duplicata para usar uma **RPC no banco** que possa verificar a existência do contato **ignorando RLS** (via SECURITY DEFINER) ou melhorar a mensagem de erro.

**Opção A (Recomendada):** Criar função RPC `check_contact_exists_by_phone(phone)` que retorna `{exists: boolean, contact_name: string | null, assigned_to_name: string | null}`

**Opção B (Mais simples):** Melhorar a mensagem de erro quando ocorrer violação de constraint:

```typescript
if (error.code === '23505') {
  toast.error('Já existe um contato com este telefone no sistema. Ele pode estar atribuído a outro atendente.');
  throw new Error('Contato com este telefone já existe no sistema');
}
```

---

## Causa #2: Falta Validação de Permissão na Interface

**Localização:** `src/pages/Contacts.tsx` (linhas 570-576, 814-820)

### O que acontece:

O botão "Adicionar Contato" está visível para todos os usuários, mas:
- Alguns tenants têm o role `vendedor` configurado **sem** a permissão `contacts.create`
- A permissão `can.createContacts()` existe mas **não está sendo usada**

### Correção Proposta:

Envolver o botão com PermissionGate ou condicional:

```tsx
// Opção A: Com PermissionGate
<PermissionGate permission="contacts.create">
  <button onClick={handleNewContact} ...>
    <Plus size={18} />
    Adicionar Contato
  </button>
</PermissionGate>

// Opção B: Com hook usePermissions
const { can } = usePermissions();
{can.createContacts() && (
  <button onClick={handleNewContact} ...>
    <Plus size={18} />
    Adicionar Contato
  </button>
)}
```

---

## Causa #3: Role Definitions Incompletas

**Localização:** Banco de dados, tabela `role_definitions`

### O que acontece:

Alguns tenants têm a configuração de vendedor com permissões incompletas:

| Tenant | Permissões de Contacts |
|--------|------------------------|
| `664dfcb4-...` | `{"view": true}` (falta create) |
| `99ca7ab2-...` | `null` (sem permissões!) |
| Outros | `{"create": true, "update": true, "view": true}` |

### Correção Proposta:

Executar SQL para corrigir as role_definitions dos vendedores:

```sql
UPDATE role_definitions
SET permissions = jsonb_set(
  COALESCE(permissions, '{}'::jsonb),
  '{contacts}',
  '{"view": true, "create": true, "update": true}'::jsonb
)
WHERE role_key = 'vendedor'
  AND (
    permissions->'contacts'->'create' IS NULL
    OR permissions->'contacts'->'create' = 'false'::jsonb
  );
```

---

## Arquivos a Modificar

| Arquivo | Tipo de Mudança |
|---------|-----------------|
| `src/hooks/useContacts.ts` | Melhorar mensagem de erro para duplicatas |
| `src/pages/Contacts.tsx` | Adicionar verificação de permissão no botão |
| Banco de dados | Corrigir role_definitions |

---

## Ordem de Implementação

1. **Corrigir role_definitions no banco** - Isso resolve para a maioria dos casos
2. **Melhorar tratamento de erro de duplicata** - Mensagem mais clara para o usuário
3. **Adicionar verificação de permissão no botão** - Ocultar botão para quem não tem permissão

---

## Validação

Após implementação:
1. Verificar se vendedor consegue adicionar contato novo
2. Verificar se aparece mensagem clara ao tentar adicionar contato duplicado
3. Verificar se botão fica oculto para roles sem permissão `contacts.create`

---

## Complexidade e Risco

- **Complexidade:** Baixa
- **Risco:** Baixo (correções incrementais)
- **Arquivos afetados:** 2 + SQL no banco
