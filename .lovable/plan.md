
# Correção: Automações de Status de Lead Falhando para Usuários

## 🎯 Diagnóstico Confirmado

### O Problema
Quando vendedores enviam mensagens rápidas com palavras-chave configuradas, o fluxo de automação é disparado corretamente MAS o nó `set_lead_status` **falha silenciosamente** com erro:

```
Erro ao alterar status: tenant_id é obrigatório e não foi possível determinar automaticamente
```

### Evidência nos Logs
```
19:03:24 - Executando nó: set_lead_status
19:03:24 - Erro ao alterar status: tenant_id é obrigatório e não foi possível determinar automaticamente
```

### Causa Raiz
A Edge Function `execute-flow-node` usa `SUPABASE_SERVICE_ROLE_KEY` (ignora RLS), mas quando atualiza `contacts.lead_status`:

1. O trigger `track_lead_status_change` é acionado
2. Este trigger insere um registro em `lead_status_history`
3. A tabela `lead_status_history` tem o trigger `set_tenant_id_from_user`
4. Como não há usuário autenticado (apenas service role), `get_user_tenant_id()` retorna NULL
5. A função lança exceção: **"tenant_id é obrigatório e não foi possível determinar automaticamente"**

### Cascata do Erro
```
execute-flow-node (UPDATE contacts)
    └─→ track_lead_status_change (INSERT lead_status_history)
            └─→ set_tenant_id_from_user ❌ ERRO: tenant_id NULL
```

---

## Solução

### Opção 1: Modificar a função `track_lead_status_change` (RECOMENDADA)

Alterar a função para incluir explicitamente o `tenant_id` do contato ao inserir no histórico:

```sql
CREATE OR REPLACE FUNCTION track_lead_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_duration INTEGER;
BEGIN
  IF OLD.lead_status IS DISTINCT FROM NEW.lead_status THEN
    v_duration := EXTRACT(EPOCH FROM (NOW() - COALESCE(OLD.updated_at, OLD.created_at)))::INTEGER;
    
    INSERT INTO lead_status_history (
      contact_id, 
      previous_status, 
      new_status, 
      changed_by,
      duration_seconds,
      tenant_id  -- ← ADICIONAR
    )
    VALUES (
      NEW.id,
      OLD.lead_status,
      NEW.lead_status,
      auth.uid(),
      v_duration,
      NEW.tenant_id  -- ← Usar tenant_id do contato
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Arquivo a Criar

| Arquivo | Descrição |
|---------|-----------|
| `supabase/migrations/[TIMESTAMP]_fix-lead-status-history-tenant.sql` | Atualiza função para incluir tenant_id explícito |

---

## Conteúdo da Migration

```sql
-- =========================================================================
-- CORREÇÃO: Automação set_lead_status falhando para Edge Functions
-- =========================================================================
-- PROBLEMA: Edge Functions com service_role não têm usuário autenticado,
-- então o trigger set_tenant_id_from_user falha ao inserir em lead_status_history
-- 
-- SOLUÇÃO: A função track_lead_status_change deve incluir tenant_id explicitamente
-- =========================================================================

CREATE OR REPLACE FUNCTION track_lead_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_duration INTEGER;
BEGIN
  -- Só registra se o status realmente mudou
  IF OLD.lead_status IS DISTINCT FROM NEW.lead_status THEN
    -- Calcular duração no status anterior (em segundos)
    v_duration := EXTRACT(EPOCH FROM (NOW() - COALESCE(OLD.updated_at, OLD.created_at)))::INTEGER;
    
    INSERT INTO lead_status_history (
      contact_id, 
      previous_status, 
      new_status, 
      changed_by,
      duration_seconds,
      tenant_id  -- CORREÇÃO: Incluir tenant_id explícito
    )
    VALUES (
      NEW.id,
      OLD.lead_status,
      NEW.lead_status,
      auth.uid(),  -- Pode ser NULL quando chamado por Edge Function
      v_duration,
      NEW.tenant_id  -- Pegar tenant_id do contato que está sendo atualizado
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Resultado Esperado

Após a correção:

| Situação | Antes | Depois |
|----------|-------|--------|
| Admin envia mensagem rápida | ✅ Funciona | ✅ Funciona |
| Vendedor envia mensagem rápida | ❌ Erro "tenant_id obrigatório" | ✅ Status atualizado |
| `contacts.lead_status` | Não atualiza | ✅ Atualizado |
| `conversations.lead_status` | Não atualiza | ✅ Atualizado |
| `lead_status_history` | Não registra | ✅ Registrado |

---

## Correção Adicional (Opcional)

Para corrigir os registros dessincronizados existentes, executar:

```sql
-- Sincronizar conversations.lead_status com contacts.lead_status
UPDATE conversations conv
SET lead_status = c.lead_status
FROM contacts c
WHERE conv.contact_id = c.id
  AND conv.status IN ('open', 'pending')
  AND conv.lead_status != c.lead_status
  AND c.tenant_id = '664dfcb4-5432-4c14-9838-7db14360cabf';
```

---

## Por que o Admin funcionava e vendedores não?

Quando o **Admin** envia mensagem:
- O webhook processa e chama `process-flow-triggers`
- A Edge Function usa service_role
- MAS: O admin pode ter feito a atualização manualmente (não via automação)

Quando **Vendedores** enviam:
- Mesmo fluxo, mas 100% via automação
- Service_role não tem `auth.uid()` → `get_user_tenant_id()` retorna NULL
- Trigger falha ao inserir no histórico

Com a correção, ambos funcionarão porque o `tenant_id` será obtido do próprio contato (`NEW.tenant_id`), não do usuário autenticado.
