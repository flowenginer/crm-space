
# Plano: Corrigir Criação de Tags pelos Vendedores da Master

## Diagnóstico

Identifiquei a causa raiz do erro ao criar tags diretamente do chat:

### O Problema

| Tabela | Política INSERT PERMISSIVE | Status |
|--------|---------------------------|--------|
| `contacts` | "Authenticated users can create contacts" com `with_check: auth.uid() IS NOT NULL` | Funciona |
| `tags` | Nenhuma política INSERT específica | **BLOQUEADO** |

A política existente "Authenticated access tags" é do tipo `ALL` mas tem `with_check = NULL`, o que não autoriza operações de INSERT.

A política RESTRICTIVE "Tenant isolation for tags" tem `with_check` definido, mas políticas RESTRICTIVE precisam ser combinadas com pelo menos uma PERMISSIVE que tenha `with_check` para INSERT funcionar.

### Fluxo atual (falha)

```text
Vendedor tenta criar tag
        |
        v
Política PERMISSIVE "Authenticated access tags"
  - with_check: NULL (não define condição INSERT)
        |
        v
Política RESTRICTIVE "Tenant isolation for tags"  
  - with_check: (tenant_id IS NULL) OR (tenant_id = get_user_tenant_id())
        |
        v
ERRO: Sem política PERMISSIVE com with_check = INSERT bloqueado
```

---

## Solução

Criar uma política RLS específica para INSERT na tabela `tags`, similar à existente em `contacts`.

### Arquivo a criar

`supabase/migrations/xxx.sql`

### SQL da migração

```sql
-- Adicionar política de INSERT para tags (igual a contacts)
CREATE POLICY "Authenticated users can create tags"
  ON tags FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

COMMENT ON POLICY "Authenticated users can create tags" ON tags 
  IS 'Permite usuários autenticados criarem tags - tenant_id validado pela política RESTRICTIVE';
```

---

## Detalhes Técnicos

### Por que funciona

1. A nova política PERMISSIVE permite INSERT quando o usuário está autenticado
2. A política RESTRICTIVE existente garante que `tenant_id` seja NULL ou do tenant do usuário
3. O trigger `trigger_set_tenant_id_tags` define automaticamente o `tenant_id` correto após o INSERT

### Fluxo corrigido

```text
Vendedor tenta criar tag
        |
        v
Política PERMISSIVE "Authenticated users can create tags"
  - with_check: auth.uid() IS NOT NULL ✓
        |
        v
Política RESTRICTIVE "Tenant isolation for tags"  
  - with_check: (tenant_id IS NULL) ✓ (código envia NULL)
        |
        v
INSERT permitido
        |
        v
Trigger set_tenant_id_from_user executa
  - Define tenant_id = get_user_tenant_id()
        |
        v
Tag criada com sucesso
```

---

## Segurança

- Isolamento de tenant mantido pela política RESTRICTIVE
- Apenas usuários autenticados podem criar tags
- `tenant_id` é definido automaticamente pelo trigger

---

## Complexidade

- **Nível:** Baixa
- **Risco:** Baixo (apenas adiciona permissão que estava faltando)
- **Tempo:** Imediato (apenas migration SQL)
