
# Plano: Corrigir Blocos de Atualização de Status nas Automações da Master

## Diagnóstico

Identifiquei a **causa raiz** dos problemas nas automações da Master:

### Problema: DEFAULT Incorreto em `flow_connections`

A tabela `flow_connections` tem um `tenant_id` DEFAULT fixo que pertence ao tenant **Space Sports** (`00000000-0000-0000-0000-000000000001`), quando deveria usar o tenant do usuário autenticado.

**Evidência da Query:**
```sql
-- EMPREGA MAIS - PROTOCOLO AGENDAMENTO tem conexões com tenant ERRADO
tenant_id: 00000000-0000-0000-0000-000000000001 (Space Sports)

-- Outros fluxos da Master têm conexões CORRETAS  
tenant_id: 664dfcb4-5432-4c14-9838-7db14360cabf (Master)
```

### Impacto

Quando conexões são criadas/editadas no Flow Editor:
1. O código **NÃO** envia `tenant_id` explicitamente
2. O banco usa o DEFAULT: `00000000-0000-0000-0000-000000000001`
3. Políticas RLS podem bloquear operações ou causar vazamento de dados entre tenants

---

## Solução

### 1. Alterar DEFAULT da Coluna (Banco de Dados)

```sql
-- Mudar de UUID fixo para função dinâmica
ALTER TABLE flow_connections 
ALTER COLUMN tenant_id 
SET DEFAULT get_user_tenant_id();
```

### 2. Atualizar Flow Editor (Código)

**Arquivo:** `src/pages/FlowEditor.tsx` (linhas ~418-424)

**Modificação:** Incluir `tenant_id` explicitamente ao inserir conexões

**De:**
```typescript
const connectionsToInsert = [...uniqueConnections.values()];

if (connectionsToInsert.length > 0) {
  const { error: connError } = await supabase
    .from('flow_connections')
    .insert(connectionsToInsert);
```

**Para:**
```typescript
// Buscar tenant_id do fluxo
const { data: flowData } = await supabase
  .from('chatbot_flows')
  .select('tenant_id')
  .eq('id', flowId)
  .single();

const connectionsWithTenant = connectionsToInsert.map(conn => ({
  ...conn,
  tenant_id: flowData?.tenant_id
}));

if (connectionsWithTenant.length > 0) {
  const { error: connError } = await supabase
    .from('flow_connections')
    .insert(connectionsWithTenant);
```

### 3. Corrigir Conexões Existentes com Tenant Errado

```sql
-- Atualizar conexões do fluxo "EMPREGA MAIS - PROTOCOLO AGENDAMENTO"
UPDATE flow_connections 
SET tenant_id = '664dfcb4-5432-4c14-9838-7db14360cabf'
WHERE flow_id = 'f2260719-fcf9-4b09-85ed-b13e733b29fd'
  AND tenant_id = '00000000-0000-0000-0000-000000000001';

-- Verificar se há outros fluxos afetados
UPDATE flow_connections c
SET tenant_id = f.tenant_id
FROM chatbot_flows f
WHERE c.flow_id = f.id
  AND c.tenant_id != f.tenant_id;
```

---

## Outras Tabelas Afetadas

Essas tabelas **também** usam o DEFAULT incorreto:

| Tabela | DEFAULT Atual | Ação Necessária |
|--------|---------------|-----------------|
| `flow_executions` | `00000000-...001` | Alterar para `get_user_tenant_id()` |
| `flow_execution_logs` | `00000000-...001` | Alterar para `get_user_tenant_id()` |
| `scheduled_messages` | ✅ JÁ CORRIGIDO | Nenhuma |

**Migração Completa:**
```sql
ALTER TABLE flow_executions 
ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();

ALTER TABLE flow_execution_logs 
ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();

ALTER TABLE flow_connections 
ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
```

---

## Arquivos a Modificar

1. **Migração SQL** - Alterar DEFAULTs de 3 tabelas
2. **src/pages/FlowEditor.tsx** - Enviar `tenant_id` ao criar conexões
3. **supabase/functions/process-flow-triggers/index.ts** - Verificar se precisa enviar `tenant_id` ao criar execuções

---

## Por Que Isso Aconteceu?

O tenant `00000000-0000-0000-0000-000000000001` foi provavelmente usado como:
- Tenant padrão durante desenvolvimento
- Valor de fallback em produção

Para sistemas **multi-tenant**, o correto é **sempre** usar `get_user_tenant_id()` como DEFAULT para garantir isolamento automático.

---

## Seção Técnica

### Fluxos da Master Afetados

Apenas **"EMPREGA MAIS - PROTOCOLO AGENDAMENTO"** tem conexões com `tenant_id` errado. Os outros 5 fluxos ativos estão corretos.

### Validação

Após aplicar as correções, executar:

```sql
-- Verificar se todas as conexões têm tenant_id correto
SELECT f.name, c.tenant_id, count(*) 
FROM chatbot_flows f
JOIN flow_connections c ON c.flow_id = f.id
WHERE f.tenant_id = '664dfcb4-5432-4c14-9838-7db14360cabf'
GROUP BY f.name, c.tenant_id
HAVING c.tenant_id != f.tenant_id;

-- Resultado esperado: 0 linhas
```
