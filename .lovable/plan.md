

# Correção Urgente: Vendedores Vendo Leads de Outros na Master

## Diagnóstico Confirmado

### O Problema
Os vendedores da Master estão vendo e podendo transferir leads atribuídos a outros vendedores, violando o isolamento de dados.

### Causa Raiz
As funções SQL `can_view_all_data()` e `can_transfer_freely()` **não estão aplicando a lógica de prioridade correta**.

**Lógica atual (ERRADA):**
```sql
IF user_flag = TRUE THEN  -- Só verifica se é TRUE
  RETURN TRUE;
END IF;
-- Depois verifica departamento...
```

**Lógica correta (NÃO APLICADA):**
```sql
IF user_flag IS NOT NULL THEN  -- Verifica se foi definido
  RETURN user_flag;            -- Retorna o valor (TRUE ou FALSE)
END IF;
-- Só verifica departamento se user_flag = NULL
```

### Dados no Banco
| Vendedor | can_view_all (usuário) | can_view_all (departamento) | Resultado Atual | Esperado |
|----------|------------------------|------------------------------|-----------------|----------|
| Beatriz | FALSE | TRUE (Emprega Mais) | TRUE ❌ | FALSE ✅ |
| Bruna | FALSE | TRUE (Master Leads) | TRUE ❌ | FALSE ✅ |
| Nadia | FALSE | TRUE (Emprega Mais) | TRUE ❌ | FALSE ✅ |
| Rainy | FALSE | TRUE (Emprega Mais) | TRUE ❌ | FALSE ✅ |
| Susana | FALSE | TRUE (Master Leads) | TRUE ❌ | FALSE ✅ |

A migration `20260204170000_fix-permission-priority-logic.sql` existe no código mas **não foi aplicada ao banco de produção**.

---

## Solução

### 1. Aplicar correção nas funções SQL

Atualizar as duas funções para respeitar o bloqueio explícito do usuário:

**Arquivo: `supabase/migrations/[TIMESTAMP]_fix-permission-priority-urgent.sql`**

```sql
-- =========================================================================
-- CORREÇÃO URGENTE: Funções de Acesso Especial
-- =========================================================================
-- PROBLEMA: Vendedores com can_view_all = FALSE estão vendo leads de outros
-- CAUSA: A função ignora FALSE e vai direto para o departamento
-- SOLUÇÃO: Se user_flag é NOT NULL, usar esse valor e ignorar departamento
-- =========================================================================

-- FUNÇÃO 1: can_transfer_freely
CREATE OR REPLACE FUNCTION public.can_transfer_freely(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_role text;
  user_flag boolean;  -- Pode ser TRUE, FALSE ou NULL
  user_tenant_id uuid;
  dept_flag boolean;
BEGIN
  SELECT role, can_transfer_freely, tenant_id
  INTO user_role, user_flag, user_tenant_id
  FROM profiles WHERE id = _user_id;

  IF user_tenant_id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF user_role IN ('admin', 'supervisor') THEN
    RETURN TRUE;
  END IF;

  -- CORREÇÃO: Se user_flag foi definido (TRUE ou FALSE), usar esse valor
  IF user_flag IS NOT NULL THEN
    RETURN user_flag;
  END IF;

  -- Só verifica departamento se user_flag é NULL
  SELECT EXISTS (
    SELECT 1 FROM user_departments ud
    INNER JOIN departments d ON d.id = ud.department_id
    WHERE ud.user_id = _user_id
    AND ud.tenant_id = user_tenant_id
    AND d.tenant_id = user_tenant_id
    AND d.can_transfer_freely = TRUE
  ) INTO dept_flag;

  RETURN COALESCE(dept_flag, FALSE);
END;
$function$;

-- FUNÇÃO 2: can_view_all_data
CREATE OR REPLACE FUNCTION public.can_view_all_data(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_role text;
  user_flag boolean;  -- Pode ser TRUE, FALSE ou NULL
  user_tenant_id uuid;
  caller_tenant_id uuid;
  dept_flag boolean;
BEGIN
  SELECT tenant_id INTO caller_tenant_id FROM profiles WHERE id = auth.uid();
  
  SELECT role, can_view_all_conversations, tenant_id 
  INTO user_role, user_flag, user_tenant_id 
  FROM profiles WHERE id = _user_id;
  
  IF user_tenant_id IS DISTINCT FROM caller_tenant_id THEN
    RETURN FALSE;
  END IF;
  
  IF user_role IN ('admin', 'supervisor') THEN
    RETURN TRUE;
  END IF;
  
  -- CORREÇÃO: Se user_flag foi definido (TRUE ou FALSE), usar esse valor
  IF user_flag IS NOT NULL THEN
    RETURN user_flag;
  END IF;
  
  -- Só verifica departamento se user_flag é NULL
  SELECT EXISTS (
    SELECT 1 FROM user_departments ud
    INNER JOIN departments d ON d.id = ud.department_id
    WHERE ud.user_id = _user_id 
    AND d.can_view_all_conversations = TRUE
    AND d.tenant_id = caller_tenant_id
  ) INTO dept_flag;
  
  RETURN COALESCE(dept_flag, FALSE);
END;
$function$;
```

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `supabase/migrations/[TIMESTAMP]_fix-permission-priority-urgent.sql` | Criar nova migration |

---

## Resultado Esperado

Após a correção:

| Vendedor | Antes | Depois |
|----------|-------|--------|
| Beatriz | Vê todos os leads | Vê apenas seus leads |
| Bruna | Vê todos e transfere qualquer | Vê apenas seus leads, transfere apenas seus |
| Nadia | Vê todos e transfere qualquer | Vê apenas seus leads, transfere apenas seus |
| Todos os outros | Idem | Bloqueio correto aplicado |

### Lógica Final:
1. **Admin/Supervisor** → sempre `TRUE`
2. **Usuário com flag TRUE** → `TRUE` (liberado explicitamente)
3. **Usuário com flag FALSE** → `FALSE` (bloqueado, ignora departamento)
4. **Usuário com flag NULL** → verifica departamento

---

## Testes de Validação

Após aplicar a migration, executar estas queries para confirmar:

```sql
-- Deve retornar FALSE para vendedores com can_view_all = FALSE
SELECT full_name, can_view_all_data(id) as result
FROM profiles 
WHERE tenant_id = '664dfcb4-5432-4c14-9838-7db14360cabf'
AND role = 'vendedor';

-- Beatriz (can_transfer = FALSE) deve retornar FALSE
SELECT can_transfer_freely('e7a9fd22-e3ff-40b9-b01c-93549db399d0');
```

