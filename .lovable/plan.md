
# Plano: Corrigir Erro de Nota Interna para Usuários Master

## Diagnóstico

Identifiquei que o erro é **IDÊNTICO** ao problema das tags que corrigimos há pouco.

### Causa Raiz

| Aspecto | `internal_notes` | `tags` (após correção) |
|---------|-----------------|------------------------|
| Política INSERT PERMISSIVE | ❌ `with_check = NULL` | ✅ `with_check = auth.uid() IS NOT NULL` |
| Resultado | **Bloqueia INSERT da Master** | Funciona |

### Por que funciona para Space Sports?

```text
Space Sports (00000000-0000-0000-0000-000000000001):
  - Coluna tenant_id DEFAULT = 00000000...
  - get_user_tenant_id() = 00000000...
  - Política RESTRICTIVE: tenant_id IS NULL OR tenant_id = 00000000... ✅

Master (664dfcb4-5432-4c14-9838-7db14360cabf):
  - Coluna tenant_id DEFAULT = 00000000...
  - get_user_tenant_id() = 664dfcb4...
  - Código envia tenant_id = NULL
  - PostgreSQL usa DEFAULT = 00000000...
  - Política RESTRICTIVE: 00000000... = 664dfcb4... ❌ FALHA
```

### Fluxo do Erro

```text
Usuário Master clica "Adicionar Nota"
        │
        ▼
INSERT sem tenant_id (código envia NULL)
        │
        ▼
Política PERMISSIVE "Authenticated access"
  with_check: NULL (não define regra INSERT)
        │
        ▼
Política RESTRICTIVE "Tenant isolation"
  with_check: (tenant_id IS NULL) OR (tenant_id = get_user_tenant_id())
        │
        ├── tenant_id recebe DEFAULT = 00000000... (Space Sports)
        ├── get_user_tenant_id() = 664dfcb4... (Master)
        ▼
  00000000... ≠ 664dfcb4... = ERRO RLS
```

---

## Solução

Criar política INSERT explícita para `internal_notes`, igual fizemos para `tags`:

### Migration SQL

```sql
-- Adicionar política de INSERT para internal_notes
CREATE POLICY "Authenticated users can create internal_notes"
  ON internal_notes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

COMMENT ON POLICY "Authenticated users can create internal_notes" ON internal_notes 
  IS 'Permite usuários autenticados criarem notas - tenant_id validado pela política RESTRICTIVE e trigger';
```

### Por que funciona

1. Nova política PERMISSIVE permite INSERT quando usuário está autenticado
2. O código envia `tenant_id = NULL`
3. Política RESTRICTIVE aceita `(tenant_id IS NULL)` = **PASSA**
4. Trigger `set_tenant_id_from_user` define `tenant_id = get_user_tenant_id()` do usuário
5. Nota salva com tenant correto

### Fluxo Corrigido

```text
Usuário Master clica "Adicionar Nota"
        │
        ▼
INSERT com tenant_id = NULL
        │
        ▼
Política PERMISSIVE "Authenticated users can create internal_notes"
  with_check: auth.uid() IS NOT NULL ✅
        │
        ▼
Política RESTRICTIVE "Tenant isolation"
  with_check: (tenant_id IS NULL) ✅ (código envia NULL)
        │
        ▼
INSERT permitido
        │
        ▼
Trigger set_tenant_id_from_user executa
  NEW.tenant_id := get_user_tenant_id() = 664dfcb4...
        │
        ▼
Nota salva com tenant_id = 664dfcb4... ✅
```

---

## Detalhes Técnicos

### Arquivo a criar

`supabase/migrations/xxx.sql`

### Trigger já existe

Verifiquei que o trigger `trigger_set_tenant_id_internal_notes` já está configurado e usa a função `set_tenant_id_from_user` que define corretamente o `tenant_id` baseado no usuário autenticado.

### Segurança mantida

- Isolamento de tenant permanece via política RESTRICTIVE
- Apenas usuários autenticados podem criar notas
- Trigger garante que `tenant_id` seja sempre correto

---

## Complexidade

| Aspecto | Avaliação |
|---------|-----------|
| Nível | Baixa |
| Risco | Baixo (padrão já testado com tags) |
| Tempo | Imediato (apenas migration) |
| Impacto | Corrige erro crítico para Master sem afetar outros tenants |
