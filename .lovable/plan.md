

## Plano: Restringir visibilidade de canais para TODOS os perfis (incluindo Admin/Supervisor)

### Problema
No hook `useUserChannels` (linha 53), admins e supervisores **sempre veem todos os canais**, ignorando completamente a configuração de `user_channels`. Isso permite que um admin do canal "Emprega Mais" veja e pegue leads do canal "Master Leads".

### Solução
Alterar a lógica de prioridade no `useUserChannels` para:

1. **Se o usuário (qualquer perfil, incluindo admin) tem canais em `user_channels` → usa SOMENTE esses**
2. Se não tem configuração em `user_channels` → admin/supervisor vê todos; demais usam fallback por departamento

### Alteração

**Arquivo único:** `src/hooks/useUserChannels.ts`

Reordenar a lógica no `useMemo` (linhas 51-82):

```typescript
return useMemo(() => {
  // PRIORIDADE 1: Se o usuário tem canais configurados diretamente, usa SOMENTE esses
  // Isso vale para TODOS os perfis, incluindo Admin e Supervisor
  if (userChannelIds.length > 0) {
    const channelIdSet = new Set(userChannelIds);
    return allChannels.filter(channel => channelIdSet.has(channel.id));
  }

  // PRIORIDADE 2: Admins e Supervisores sem restrição explícita veem todos
  if (isAdmin || isSupervisor) {
    return allChannels;
  }

  // PRIORIDADE 3: Fallback por departamento (vendedores, etc.)
  // ... (código existente mantido)
}, [...]);
```

Isso garante que:
- Quem já tem `user_channels` configurado **mantém** suas restrições (nada é zerado)
- Admin sem `user_channels` continua vendo tudo (retrocompatível)
- Você pode ir configurando um por um sem quebrar nada

