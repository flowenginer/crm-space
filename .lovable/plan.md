
# Desabilitar Animação de Piscar nos Chats para Tenant Master

## Problema Identificado

A animação de "piscar" (pulse) está ativa nas conversas da lista quando há uma transferência recente. Isso afeta todos os usuários do tenant Master.

## Locais onde a animação ocorre

| Componente | Arquivo | Animação | Status |
|------------|---------|----------|--------|
| WaitingCard (banner) | `WaitingCard.tsx` | `animate-blink-red` | JÁ desabilitada para Master |
| ConversationItem (lista) | `Conversations.tsx` | `animate-pulse` | Ainda ativa (precisa desabilitar) |

## O que será alterado

Aplicar a mesma verificação de tenant Master que já existe no `WaitingCard` para o componente `ConversationItem`:

```typescript
// Verificar se é o tenant Master
const { tenantId } = useUserStore();
const isMasterTenant = tenantId === MASTER_TENANT_ID;

// Na classe CSS, remover animate-pulse para Master:
isNewTransfer && !isMasterTenant
  ? 'bg-emerald-500/20 border-l-4 border-l-emerald-500 animate-pulse'
  : isNewTransfer
    ? 'bg-emerald-500/20 border-l-4 border-l-emerald-500' // Estilo sem animação
    : ...
```

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Conversations.tsx` | Adicionar verificação `isMasterTenant` e remover `animate-pulse` para Master |

## Resultado Esperado

- Conversas transferidas continuarão com destaque visual (fundo verde, borda verde)
- A animação de piscar será removida apenas para usuários do tenant Master
- Outros tenants continuarão vendo a animação normalmente

## Observação

Futuramente, esta configuração poderia ser movida para o campo `settings` da tabela `tenants`, permitindo que cada empresa configure suas preferências de interface sem precisar de código customizado.
