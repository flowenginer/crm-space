
# Plano: Mostrar Nome do Vendedor de Origem nas Transferências

## Problema Identificado

Quando um vendedor transfere uma conversa, o card mostra "Sistema → Destino" ao invés de "Vendedor → Destino" porque:

1. **A função RPC `transfer_conversation`** grava apenas os IDs no evento, não os nomes
2. **O componente `TransferEventCard`** busca o nome do usuário **destino** mas **NÃO busca o nome da origem**

**Evidência no banco:**
```json
{
  "from_user_id": "30ff01f0-...",   // Rafik - SAC (ID existe, nome não)
  "to_user_id": "290087bf-...",     // Diego (ID existe, nome não)
  "from_user_name": null,           // ❌ Não foi salvo
  "to_user_name": null              // ❌ Não foi salvo
}
```

## Solução Proposta

### Parte 1: Buscar nome da origem no Frontend (correção imediata)

Adicionar uma query no `TransferEventCard.tsx` para buscar o nome do `from_user_id`, seguindo o mesmo padrão já usado para `to_user_id`.

**Arquivo:** `src/components/conversations/TransferEventCard.tsx`

**Adicionar nova query após a query de `toUser` (linhas 29-42):**

```typescript
// Buscar nome do usuário origem se não estiver no data
const { data: fromUser } = useQuery({
  queryKey: ['profile-name', data.from_user_id],
  queryFn: async () => {
    if (!data.from_user_id) return null;
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', data.from_user_id)
      .single();
    return profile;
  },
  enabled: !!data.from_user_id && !data.from_user_name,
  staleTime: 60000,
});
```

**Modificar a linha 62 para usar o nome buscado:**

```typescript
// Antes
const fromName = data.from_user_name || (isAutoDistribution ? 'Distribuição Automática' : 'Sistema');

// Depois
const fromName = data.from_user_name || fromUser?.full_name || 
  (isAutoDistribution ? 'Distribuição Automática' : 'Sistema');
```

### Parte 2: Gravar nomes na RPC (otimização futura)

Para evitar queries adicionais no frontend, também atualizaremos a função RPC para incluir os nomes diretamente.

**Arquivo:** Nova migration SQL

**Alteração na função `transfer_conversation`:**

```sql
DECLARE
  v_from_user_name text;
  v_to_user_name text;
  v_to_department_name text;
BEGIN
  -- Buscar nomes dos usuários
  SELECT full_name INTO v_from_user_name
  FROM profiles WHERE id = v_from_user_id;
  
  SELECT full_name INTO v_to_user_name
  FROM profiles WHERE id = p_to_user_id;
  
  SELECT name INTO v_to_department_name
  FROM departments WHERE id = v_final_department_id;

  -- No INSERT do evento, incluir os nomes:
  INSERT INTO conversation_events (...) VALUES (
    ...,
    json_build_object(
      'from_user_id', v_from_user_id,
      'from_user_name', v_from_user_name,  -- NOVO
      'to_user_id', p_to_user_id,
      'to_user_name', v_to_user_name,      -- NOVO
      'from_department_id', v_from_department_id,
      'to_department_id', v_final_department_id,
      'to_department_name', v_to_department_name,  -- NOVO
      'note', p_note
    ),
    ...
  );
```

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| Sistema → Rafik - SAC | Diego → Rafik - SAC |
| Sistema → Diego | Rafik - SAC → Diego |
| Distribuição Automática → Diego | Distribuição Automática → Diego (sem mudança) |

## Resumo

- **2 alterações no frontend**: Query + lógica de fallback no `TransferEventCard.tsx`
- **1 migration SQL**: Atualizar função `transfer_conversation` para gravar nomes
- **Benefício**: Nome do vendedor de origem sempre visível
- **Compatibilidade**: Eventos antigos funcionarão via query de fallback
