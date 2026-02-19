
# Controle de Visibilidade das Tabs de Conversas por Usuário

## Objetivo

Permitir que administradores controlem quais abas/filtros de conversas (Todas, Fixadas, Compartilhadas, Minhas, Pendentes, Não Atribuídas) cada usuário pode ver. Todos os usuários existentes começam com acesso total a todas as abas — basta desativar o que não deve ser visível.

## Como o Sistema Já Funciona (Contexto)

O sistema já possui toda a infraestrutura necessária:

- `profiles.permissions` (JSONB) armazena overrides individuais por usuário, com prioridade sobre as permissões do perfil/role
- `hasPermission('conversations', 'view_pending')` e `hasPermission('conversations', 'view_unassigned')` já existem e já controlam parcialmente as abas Pendentes e Não Atribuídas
- O array `availableQuickFilters` em `Conversations.tsx` já filtra quais abas aparecem com base nessas permissões
- As abas "Todas", "Fixadas", "Compartilhadas" e "Minhas" hoje são sempre mostradas para todos

## O Que Será Adicionado

Novas permissões granulares para as 6 abas no arquivo `src/config/permissions.ts`:

```text
conversations.tab_all        → Aba "Todas"
conversations.tab_pinned     → Aba "Fixadas"  
conversations.tab_shared     → Aba "Compartilhadas"
conversations.tab_mine       → Aba "Minhas"
conversations.tab_pending    → Aba "Pendentes" (já existe como view_pending)
conversations.tab_unassigned → Aba "Não Atribuídas" (já existe como view_unassigned)
```

## Onde Cada Peça Será Tocada

### 1. `src/config/permissions.ts`
Adicionar 4 novas permissões na categoria `conversations`:
- `conversations.tab_all` — Aba "Todas"
- `conversations.tab_pinned` — Aba "Fixadas"
- `conversations.tab_shared` — Aba "Compartilhadas"
- `conversations.tab_mine` — Aba "Minhas"

(Pendentes e Não Atribuídas já existem como `view_pending` e `view_unassigned`)

### 2. `src/pages/Conversations.tsx` — Lógica de `availableQuickFilters`
Atualmente (linhas 1559-1571), o array começa fixo com `['all', 'pinned', 'shared', 'mine']` e adiciona `pending` e `unassigned` condicionalmente. Será mudado para:

```text
Antes (hoje):
  filters = ['all', 'pinned', 'shared', 'mine']
  if (canViewPending) → push('pending')
  if (canViewUnassigned) → push('unassigned')

Depois:
  if (canTabAll OR isAdmin)     → push('all')
  if (canTabPinned OR isAdmin)  → push('pinned')
  if (canTabShared OR isAdmin)  → push('shared')
  if (canTabMine OR isAdmin)    → push('mine')
  if (canViewPending OR isAdmin) → push('pending')
  if (canViewUnassigned OR isAdmin) → push('unassigned')
```

Para não quebrar usuários existentes, a lógica de fallback será: **se o usuário não tiver NENHUMA permissão de tab configurada, mostra todas** (retrocompatibilidade).

### 3. `src/components/settings/AccessPermissionsSettings.tsx`
Adicionar uma nova seção "Abas de Conversas" no card de configuração por usuário. Cada usuário terá 6 switches, um por aba. O padrão de todos começa como `true` (todos habilitados).

A seção ficará assim:

```text
[Card: Por Usuário]
  ┌─────────────────────────────┐
  │ Avatar | Nome | Role         │
  │                              │
  │ Ver  Transf.                 │  ← switches atuais
  │                              │
  │ [v] Todas  [v] Fixadas       │  ← novos switches de abas
  │ [v] Compart. [v] Minhas     │
  │ [v] Pendentes [v] Não Atrib.│
  └─────────────────────────────┘
```

### 4. Migration SQL (sem tocar na tabela — usa `profiles.permissions` existente)
Nenhuma coluna nova será criada. O sistema já salva overrides em `profiles.permissions` (JSONB). A mutation de update simplesmente escreve:
```json
{
  "conversations": {
    "tab_all": true,
    "tab_pinned": true,
    "tab_shared": true,
    "tab_mine": true,
    "view_pending": true,
    "view_unassigned": true
  }
}
```
Usuários sem esse campo configurado verão todas as abas (fallback gracioso).

## Compatibilidade com Usuários Existentes

Todos os usuários existentes **não têm** as permissões `tab_*` configuradas em `profiles.permissions`. A lógica de `hasPermission()` retorna `false` quando a permissão não existe — então usaremos a seguinte regra:

```text
canShowTab = hasPermission('conversations', 'tab_X') !== false
           = true se UNDEFINED (não configurado) OU se configurado como true
           = false APENAS se explicitamente configurado como false
```

Isso garante que todos os usuários atuais continuem vendo todas as abas. O administrador só precisa **desativar** o que não quer mostrar.

## Seção Técnica

### Arquivos a modificar:
1. `src/config/permissions.ts` — Adicionar 4 novas permissões `tab_*`
2. `src/pages/Conversations.tsx` — Modificar `availableQuickFilters` (linhas ~1559-1571) e adicionar os 4 novos `canTab*` vars
3. `src/components/settings/AccessPermissionsSettings.tsx` — Adicionar seção de controle de abas por usuário com 6 switches, expandindo o card de usuários existente

### Lógica de permissão no hook `usePermissions`:
O `hasPermission()` já funciona perfeitamente:
- Se `profile.permissions.conversations.tab_all === undefined` → `return false` (hoje)
- Mas a nova lógica em `availableQuickFilters` tratará `undefined` como `true` (permissão implícita se não configurada)
- Isso se faz verificando `profile.permissions?.conversations?.tab_all !== false` no lugar de `hasPermission()`

### Mutation para salvar:
A `AccessPermissionsSettings` fará `supabase.from('profiles').update({ permissions: mergedPermissions }).eq('id', userId)`, preservando as permissões existentes e apenas atualizando as chaves de `tab_*`.

### Onde NÃO haverá mudanças:
- Nenhuma mudança em banco de dados (sem migrations)
- Nenhuma mudança em RLS policies
- Nenhuma mudança em edge functions
- O sistema de permissões por role/perfil não é alterado (tabs podem ser configuradas individualmente por usuário)
