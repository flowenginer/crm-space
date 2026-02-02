
# Plano: Configurações de Visibilidade e Transferência por Tenant

## Resumo

Sim! É totalmente possível fazer essa diferenciação entre os tenants:

| Tenant | Visualização | Transferência |
|--------|--------------|---------------|
| **Space Sports** | Apenas leads próprios | Apenas leads próprios |
| **Master** | Todos os leads do tenant | Pode transferir qualquer lead + opção "Pra mim" |

A arquitetura atual já suporta isso através das flags `can_view_all_conversations` e `can_transfer_freely` que podem ser configuradas por departamento ou por usuário.

---

## Diagnóstico Atual

### Master (tenant 664dfcb4...)
- `can_view_all_conversations` = **true** em todos os departamentos ✅
- `can_transfer_freely` = **false** em todos os departamentos ⚠️

### Space Sports (tenant 00000000...)
- `can_view_all_conversations` = **false** na maioria dos departamentos ✅
- `can_transfer_freely` = **false** na maioria ✅

---

## Solução

### Parte 1: Habilitar transferência livre para Master

Migration SQL para ativar `can_transfer_freely` nos departamentos da Master:

```sql
UPDATE departments 
SET can_transfer_freely = true 
WHERE tenant_id = '664dfcb4-5432-4c14-9838-7db14360cabf';
```

### Parte 2: Adicionar opção "Pra Mim" no modal de transferência

Modificar o `TransferModal.tsx` para:

1. Detectar se o usuário atual pode transferir livremente (`canTransferFreely`)
2. Adicionar um botão rápido "Pra Mim" que auto-seleciona o usuário logado
3. O botão só aparece quando a conversa NÃO está atribuída ao usuário atual

---

## Alterações nos Arquivos

### Arquivo: `supabase/migrations/xxx.sql`

```sql
-- Habilitar transferência livre para todos os departamentos da Master
UPDATE departments 
SET can_transfer_freely = true 
WHERE tenant_id = '664dfcb4-5432-4c14-9838-7db14360cabf';

COMMENT ON TABLE departments 
IS 'can_transfer_freely=true permite que membros transfiram qualquer conversa, não apenas as atribuídas a eles';
```

### Arquivo: `src/components/conversations/TransferModal.tsx`

Adicionar:
- Import do hook `usePermissions` para acessar `canTransferFreely`
- Import do `useAuth` para obter o usuário atual
- Novo botão "Pra Mim" que:
  - Só aparece se `canTransferFreely === true`
  - Só aparece se a conversa não é do usuário atual
  - Auto-seleciona o departamento do usuário + o próprio usuário
  - Executa a transferência com um clique

**Localização**: Antes da seção "Tipo de transferência", adicionar card destacado:

```tsx
{/* Opção rápida "Pra Mim" - só aparece para quem pode transferir livremente */}
{canTransferFreely && currentAssignedTo !== user?.id && (
  <div className="mb-4">
    <Button
      onClick={handleClaimForMe}
      variant="outline"
      className="w-full h-14 border-2 border-dashed border-primary/50 hover:border-primary hover:bg-primary/5 gap-3"
    >
      <UserPlus size={20} className="text-primary" />
      <div className="text-left">
        <p className="font-semibold text-primary">Pra Mim</p>
        <p className="text-xs text-muted-foreground">Assumir este atendimento</p>
      </div>
    </Button>
  </div>
)}
```

**Lógica do `handleClaimForMe`**:
```tsx
const handleClaimForMe = async () => {
  // Buscar departamento primário do usuário
  const userDeptId = await getUserPrimaryDepartment(user.id);
  
  await transferConversation.mutateAsync({
    conversationId,
    toUserId: user.id,
    toUserName: profile?.full_name || 'Você',
    toDepartmentId: userDeptId,
    toDepartmentName: null,
    note: 'Assumido pelo atendente',
  });
  
  toast.success('Conversa assumida com sucesso!');
  onTransferSuccess?.();
  handleClose();
};
```

---

## Fluxo Visual

```text
Usuário Master clica em "Transferir"
        |
        v
+------------------------------------------+
|  [🙋 Pra Mim - Assumir este atendimento] |  <- NOVO BOTÃO
+------------------------------------------+
|                                          |
|  Tipo de transferência:                  |
|  [Para atendente] [Para fila]            |
|                                          |
|  Departamento: [...]                     |
|  Atendente: [...]                        |
+------------------------------------------+
```

---

## Segurança

- A verificação `canTransferFreely` usa a função SQL `can_transfer_freely()` que verifica:
  1. Se o usuário é admin/supervisor (sempre pode)
  2. Se o usuário tem `can_transfer_freely = true` no perfil
  3. Se algum departamento do usuário tem `can_transfer_freely = true`

- A Space Sports continua com `can_transfer_freely = false`, então o botão "Pra Mim" não aparece para eles

---

## Complexidade

| Aspecto | Avaliação |
|---------|-----------|
| Risco | Baixo - apenas adiciona funcionalidade |
| Tempo | ~30 minutos |
| Impacto | Nenhum para Space, melhoria UX para Master |

