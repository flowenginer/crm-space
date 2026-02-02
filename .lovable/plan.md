
# Plano de Correção: Criação de Contatos e Transferência na Conta Master

## Diagnóstico

Após análise dos logs e código, identifiquei **2 problemas distintos**:

---

## Problema #1: Criação de Contatos - Erro de Duplicata

### O que está acontecendo:

O erro principal é **telefone duplicado**, não um problema de permissão RLS:

```
duplicate key value violates unique constraint "contacts_phone_tenant_unique"
```

### Por que acontece:

1. O vendedor tenta criar contato com telefone X
2. Esse telefone já existe no sistema (atribuído a outro vendedor)
3. Devido ao RLS, o vendedor não consegue "ver" o contato existente
4. O INSERT falha por constraint de unicidade
5. A mensagem de erro que implementamos na última correção deveria aparecer, mas pode não estar funcionando corretamente

### Verificação necessária:

Verificar se a mensagem de erro melhorada (`toast.error('Já existe um contato com este telefone no sistema...')`) está aparecendo corretamente.

### Políticas RLS atuais (corretas):

| Política | Tipo | Condição |
|----------|------|----------|
| Authenticated users can create contacts | INSERT | `auth.uid() IS NOT NULL` |
| Tenant isolation for contacts | ALL (RESTRICTIVE) | `tenant_id = get_user_tenant_id()` |

As permissões de INSERT estão corretas. O problema real é a duplicata.

---

## Problema #2: Transferência de Conversas - Erro de RLS

### Erro nos logs:

```
new row violates row-level security policy for table "conversations"
```

### Causa:

Existem **3 lugares no código** que fazem UPDATE direto em `conversations` (sem usar a RPC `transfer_conversation` que é SECURITY DEFINER):

| Arquivo | Função | Linha |
|---------|--------|-------|
| `ConversationSidebar.tsx` | `updateAssignedUser` | 399-407 |
| `ConversationSidebar.tsx` | `updateDepartment` | 468-474 |
| `useConversationEvents.ts` | `useReturnConversation` | 96-106 |

### Por que falha:

A política de UPDATE em conversations só permite:
- Admins/Supervisors: `is_admin_or_supervisor(auth.uid())`
- Dono da conversa: `assigned_to = auth.uid()`
- Conversa sem dono do mesmo departamento: `assigned_to IS NULL AND department_id IN (...)`

Se a Beatriz (vendedora) tenta alterar uma conversa que não é dela, o RLS bloqueia.

### Correção proposta:

Modificar os locais que fazem UPDATE direto para usar a função RPC `transfer_conversation` ou criar novas RPCs SECURITY DEFINER para operações específicas.

---

## Correções a Implementar

### Correção 1: Migrar updates de conversa para RPC

Criar uma nova função RPC `update_conversation_assignment` SECURITY DEFINER que permita:
- Atualizar `assigned_to` e `department_id`
- Incluir validações de permissão dentro da função
- Registrar eventos de transferência

**Arquivos afetados:**
- Nova migration SQL com a função RPC
- `src/components/conversations/ConversationSidebar.tsx` - usar nova RPC
- `src/hooks/useConversationEvents.ts` - usar nova RPC

### Correção 2: Melhorar feedback de duplicata

Verificar e aprimorar o tratamento de erro no `useContacts.ts` para garantir que a mensagem correta seja exibida.

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/migrations/xxx.sql` | Nova função RPC `update_conversation_assignment` |
| `src/components/conversations/ConversationSidebar.tsx` | Usar RPC em vez de UPDATE direto |
| `src/hooks/useConversationEvents.ts` | Usar RPC no `useReturnConversation` |
| `src/hooks/useContacts.ts` | Verificar/melhorar tratamento de erro de duplicata |

---

## Complexidade e Risco

- **Complexidade:** Média
- **Risco:** Baixo (função SECURITY DEFINER já existe como modelo)
- **Arquivos afetados:** 3-4
