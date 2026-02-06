
# Desvinculação: Atendente Atual vs Responsável

## Regra de Negócio (Nova)

Alterar o **Atendente Atual** (conversations.assigned_to) de forma manual **NÃO** deve alterar o **Atendente Responsável** (contacts.assigned_to). São campos independentes.

## O que será alterado

### 1. RPC `update_conversation_assignment` (Migration SQL)

Remover o bloco que sincroniza o contato (linhas 213-222 da migration mais recente). Atualmente:

```text
-- SEMPRE sincronizar o contato quando há mudança de atribuição
IF p_assigned_to IS NOT NULL OR p_department_id IS NOT NULL THEN
  UPDATE contacts
  SET
    assigned_to = COALESCE(p_assigned_to, assigned_to),
    department_id = COALESCE(p_department_id, department_id),
    updated_at = NOW()
  WHERE id = v_contact_id
    AND tenant_id = v_conversation.tenant_id;
END IF;
```

Esse bloco será **removido** da função, de modo que alterar o atendente atual na sidebar da conversa não toque no contato.

### 2. RPC `transfer_conversation`

Remover o bloco que sincroniza o contato (linhas 132-138):

```text
-- Sincronizar o contato com a conversa
UPDATE contacts
SET
  assigned_to = p_to_user_id,
  department_id = COALESCE(v_final_department_id, department_id),
  updated_at = NOW()
WHERE id = v_contact_id;
```

Esse bloco também será **removido**, pois a transferência de conversa é uma ação sobre o atendente atual, não sobre o responsável do contato.

### 3. Nenhuma alteração no frontend

O frontend da sidebar já tem mutations separadas para "Atendente Atual" (`updateAssignedUser`) e "Atendente Responsável" (`updateOwnerAgent`). Essa separação já está correta -- o problema é exclusivamente no backend (RPCs) que forçavam a sincronização.

## Resumo Técnico

| Componente | Alteração |
|---|---|
| Nova migration SQL | Recria `update_conversation_assignment` SEM o bloco de UPDATE no contacts |
| Nova migration SQL | Recria `transfer_conversation` SEM o bloco de UPDATE no contacts |
| Frontend | Nenhuma alteração necessária |

## Resultado

- Mudar o **Atendente Atual** (conversa) = só muda a conversa
- Mudar o **Responsável** (contato) = só muda o contato (já funciona separado via `updateOwnerAgent`)
- O **modal de transferência** também não tocará mais no responsável do contato
