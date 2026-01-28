
# Plano: Corrigir Isolamento de Tenant para Criação de Contatos

## Problema Identificado

Usuários de tenants diferentes do "Space Sports" (master) não conseguem criar contatos. O erro:
```
new row violates row-level security policy "Tenant isolation for contacts" for table "contacts"
```

### Causa Raiz
A coluna `tenant_id` na tabela `contacts` tem um **DEFAULT** hardcoded para o master tenant:
```sql
column_default: '00000000-0000-0000-0000-000000000001'::uuid
```

**Fluxo do problema:**
1. Usuário de outro tenant tenta criar contato
2. O código não passa `tenant_id` explicitamente no INSERT
3. PostgreSQL aplica o DEFAULT (master tenant) **antes** da avaliação RLS
4. Política RESTRICTIVE compara: `tenant_id_default ≠ tenant_id_usuario` → **BLOQUEADO**

## Solução Proposta

### Fase 1: Correção no Banco de Dados
Remover o DEFAULT da coluna `tenant_id` e ajustar a política RLS para INSERT:

```sql
-- 1. Remover o DEFAULT problemático
ALTER TABLE contacts 
ALTER COLUMN tenant_id DROP DEFAULT;

-- 2. Ajustar a política RESTRICTIVE para permitir INSERT com tenant_id NULL
-- O trigger set_tenant_id_from_user irá preencher o valor correto
DROP POLICY IF EXISTS "Tenant isolation for contacts" ON contacts;

CREATE POLICY "Tenant isolation for contacts" ON contacts
AS RESTRICTIVE FOR ALL TO authenticated
USING (tenant_id = get_user_tenant_id())
WITH CHECK (
  -- Para INSERT: aceitar se NULL (trigger vai preencher) OU se já é o tenant correto
  tenant_id IS NULL OR tenant_id = get_user_tenant_id()
);
```

### Fase 2: Verificar Trigger
Confirmar que o trigger `set_tenant_id_from_user` está funcionando corretamente:

```sql
-- Verificar se o trigger existe e está ativo
SELECT tgname, tgenabled 
FROM pg_trigger 
WHERE tgrelid = 'contacts'::regclass 
  AND tgname = 'trigger_set_tenant_id_contacts';
```

### Fase 3: Aplicar Mesma Correção em Outras Tabelas
Verificar se outras tabelas críticas têm o mesmo problema de DEFAULT:

**Tabelas a verificar:**
- `conversations`
- `messages`
- `deals`
- `scheduled_messages`
- `contact_tags`
- `channels`

---

## Detalhes Técnicos

### Por que o trigger não funcionou?
Os triggers BEFORE INSERT executam **depois** da avaliação das políticas RLS para WITH CHECK. Como o DEFAULT é aplicado antes de tudo, a política já recebe um valor incorreto.

### Sequência de execução no PostgreSQL:
```text
1. Aplica DEFAULTs nas colunas
2. Avalia políticas RLS (WITH CHECK para INSERT)  ← BLOQUEADO AQUI
3. Executa triggers BEFORE INSERT
4. Insere o registro
5. Executa triggers AFTER INSERT
```

### Solução alternativa considerada:
Poderíamos passar `tenant_id` explicitamente no frontend, mas isso:
- Exigiria mudanças em múltiplos componentes
- Aumentaria risco de erro humano
- Não seguiria o padrão "defense in depth" já estabelecido

A correção no banco de dados é mais segura e centralizada.

---

## Arquivos Impactados

| Tipo | Local | Mudança |
|------|-------|---------|
| SQL Migration | Nova migration | Remover DEFAULT e ajustar política RLS |
| Nenhum código | - | Frontend não precisa de alteração |

## Benefícios
- ✅ Todos os tenants poderão criar contatos
- ✅ Isolamento de dados mantido (trigger + RLS)
- ✅ Código frontend não precisa de alteração
- ✅ Solução centralizada no banco de dados
