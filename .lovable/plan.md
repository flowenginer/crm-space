
# Plano: Restringir Visualização de Canais por Departamento

## Problema Identificado

Bruna e Susana estão vendo **ambos os canais** (EMPREGA-MAIS e MASTER-LEADS) na página de Conversas, mesmo que tenham sido atribuídas apenas ao departamento "Master Leads".

### Dados Atuais do Banco

| Usuário | Departamentos Atribuídos | Deveria Ver |
|---------|-------------------------|-------------|
| Susana | Master Leads | MASTER-LEADS |
| Bruna | Atendimento - Emprega Mais (primário), Master Leads | MASTER-LEADS |

| Canal | Departamento Associado |
|-------|----------------------|
| EMPREGA-MAIS | Geral |
| MASTER-LEADS | Master Leads |

### Causa Raiz

O hook `useChannels()` busca **todos os canais do tenant** sem filtrar pelo(s) departamento(s) do usuário logado:

```typescript
// src/hooks/useChannels.ts - linha 44-55
const { data, error } = await supabase
  .from('whatsapp_channels')
  .select(...)
  .eq('is_deleted', false)  // ← Sem filtro de departamento!
  .order('name');
```

---

## Solução Proposta

Criar um novo hook `useUserChannels()` que filtra os canais baseado nos departamentos do usuário atual, e utilizá-lo na página de Conversas.

### Lógica de Visibilidade

```text
┌──────────────────────────────────────────────────────────┐
│  Usuário Admin ou Supervisor?                            │
│  ┌─────────────────────┐    ┌──────────────────────────┐ │
│  │   SIM → Ver TODOS   │    │   NÃO → Continuar...     │ │
│  └─────────────────────┘    └──────────────────────────┘ │
├──────────────────────────────────────────────────────────┤
│  Buscar departamentos do usuário (user_departments)      │
├──────────────────────────────────────────────────────────┤
│  Filtrar canais onde:                                    │
│  • channel.department_id está nos departamentos do user  │
│  • OU channel.department_id é NULL (canais globais)      │
└──────────────────────────────────────────────────────────┘
```

---

## Arquivos a Criar/Modificar

### 1. Criar: `src/hooks/useUserChannels.ts`

Novo hook que retorna canais filtrados por departamento do usuário:

```typescript
export function useUserChannels() {
  const { data: profile } = useCurrentProfile();
  const { data: userDepartments = [] } = useUserDepartments(profile?.id);
  const { data: allChannels = [] } = useChannels();
  const { isAdmin, isSupervisor } = usePermissions();

  return useMemo(() => {
    // Admins e Supervisores veem todos os canais
    if (isAdmin || isSupervisor) {
      return allChannels;
    }

    // IDs dos departamentos do usuário
    const userDeptIds = userDepartments.map(ud => ud.department_id);

    // Filtrar: canais do departamento do usuário OU sem departamento (globais)
    return allChannels.filter(channel => 
      !channel.department_id || userDeptIds.includes(channel.department_id)
    );
  }, [allChannels, userDepartments, isAdmin, isSupervisor]);
}
```

### 2. Modificar: `src/pages/Conversations.tsx`

Substituir `useChannels()` por `useUserChannels()` para o filtro de canais:

```diff
- import { useChannels } from '@/hooks/useChannels';
+ import { useChannels } from '@/hooks/useChannels';
+ import { useUserChannels } from '@/hooks/useUserChannels';

  // Dentro do componente:
- const { data: channels = [] } = useChannels();
+ const { data: allChannels = [] } = useChannels();
+ const userChannels = useUserChannels();
```

E usar `userChannels` no dropdown de filtro (linhas ~3983):

```diff
- {channels.map((channel) => (
+ {userChannels.map((channel) => (
    <SelectItem key={channel.id} value={channel.id}>
      {channel.name} ({channelFilterCounts[channel.id] || 0})
    </SelectItem>
  ))}
```

---

## Resultado Esperado

| Usuário | Canais Visíveis no Filtro |
|---------|--------------------------|
| Susana (vendedor, dept: Master Leads) | MASTER-LEADS |
| Bruna (vendedor, depts: Atendimento + Master Leads) | MASTER-LEADS |
| Escola Master (admin) | Todos os canais |
| Professor (professor, dept: Geral) | EMPREGA-MAIS, Vendas Master, Venda 01 |

---

## Observações Importantes

1. **Canais sem departamento**: Canais onde `department_id = NULL` serão visíveis para todos os usuários. Isso permite canais "globais".

2. **Problema de dados atual**: O canal "EMPREGA-MAIS" está associado ao departamento "Geral", não ao "Atendimento - Emprega Mais". Se Bruna precisa ver o canal EMPREGA-MAIS, será necessário:
   - Associá-la também ao departamento "Geral", **OU**
   - Alterar o `department_id` do canal EMPREGA-MAIS para o departamento correto

3. **Impacto mínimo**: A mudança afeta apenas a **visualização do dropdown de filtro** na página de Conversas. As conversas em si já são filtradas por atribuição (assigned_to).

---

## Seção Técnica

### Dependências
- Nenhuma nova dependência necessária

### Hooks utilizados
- `useCurrentProfile()` - para obter o profile do usuário logado
- `useUserDepartments(userId)` - para obter departamentos do usuário
- `useChannels()` - para obter todos os canais (já existente)
- `usePermissions()` - para verificar se é admin/supervisor

### Performance
- O filtro é feito em memória via `useMemo`, evitando queries extras ao banco
- A query de `user_departments` já é carregada na página de Conversas
