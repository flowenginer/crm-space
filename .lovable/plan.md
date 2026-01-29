
# Plano de Correção: RLS "Tenant isolation for conversations"

## Diagnóstico

O erro ocorre porque a tabela `conversations` possui um **DEFAULT hardcoded** na coluna `tenant_id`:

```sql
column_default: '00000000-0000-0000-0000-000000000001'::uuid
```

### Fluxo do problema:
1. Usuário do tenant "Escola Master" (ID: `664dfcb4-...`) clica em "Escolher canal"
2. O código faz INSERT sem especificar `tenant_id`
3. PostgreSQL aplica o DEFAULT → `tenant_id = 00000000-0000-0000-0000-000000000001` (master tenant)
4. Os triggers encontram `tenant_id` já preenchido e não alteram
5. A política RESTRICTIVE verifica: `tenant_id = get_user_tenant_id()`
   - Lado esquerdo: `00000000-0000-0000-0000-000000000001`
   - Lado direito: `664dfcb4-5432-4c14-9838-7db14360cabf`
   - Resultado: **FALSE → INSERT bloqueado**

## Solução

Remover o DEFAULT hardcoded da coluna `tenant_id` para permitir que o trigger `set_tenant_id_from_user` funcione corretamente.

### Migração SQL

```sql
-- Remover DEFAULT hardcoded da coluna tenant_id
ALTER TABLE conversations 
ALTER COLUMN tenant_id DROP DEFAULT;
```

## Verificação Adicional

Confirmar que o padrão de multi-tenant está aplicado em outras tabelas críticas que podem ter o mesmo problema.

---

## Seção Técnica

### Tabelas Potencialmente Afetadas

Além de `conversations`, é possível que outras tabelas tenham o mesmo DEFAULT hardcoded. Após aprovar este plano, verificarei e corrigirei:
- `contacts`
- `messages`
- `whatsapp_channels`
- Outras tabelas com `tenant_id`

### Pré-requisitos
- Nenhuma alteração de código é necessária
- A política RLS e os triggers já estão corretos
- Apenas o DEFAULT precisa ser removido

### Testes
Após a migração:
1. Fazer logout e login no tenant "Escola Master"
2. Tentar criar uma nova conversa selecionando um canal
3. Verificar que a conversa é criada com o `tenant_id` correto
