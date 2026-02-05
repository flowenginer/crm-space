
# Correção: Trigger de Atribuição de Conversa

## Problema Identificado

O trigger `track_conversation_assignment()` falha ao executar SQL sem contexto de usuário autenticado porque:

1. O INSERT em `lead_assignment_history` **não inclui** a coluna `tenant_id`
2. O trigger `set_tenant_id_from_user()` tenta obter o tenant via `auth.uid()`
3. Quando não há usuário autenticado (SQL direto, Edge Functions), o tenant não pode ser determinado automaticamente

## Solução

Atualizar a função `track_conversation_assignment()` para incluir `tenant_id` explicitamente (mesmo padrão já usado em `track_lead_status_change()`).

## Alteração no Banco de Dados

Nova migration SQL para corrigir a função:

```sql
CREATE OR REPLACE FUNCTION track_conversation_assignment()
RETURNS TRIGGER AS $$
DECLARE
  v_time_to_assign INTEGER;
  v_assignment_type TEXT;
BEGIN
  -- Só registra se assigned_to mudou e o novo valor não é nulo
  IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to AND NEW.assigned_to IS NOT NULL THEN
    -- Calcular tempo desde criação da conversa até atribuição
    v_time_to_assign := EXTRACT(EPOCH FROM (NOW() - NEW.created_at))::INTEGER;
    
    -- Determinar tipo de atribuição
    IF OLD.assigned_to IS NULL THEN
      v_assignment_type := 'first_assignment';
    ELSIF NEW.status = 'open' AND OLD.status = 'closed' THEN
      v_assignment_type := 'reopen';
    ELSE
      v_assignment_type := 'transfer';
    END IF;
    
    INSERT INTO lead_assignment_history (
      contact_id,
      conversation_id,
      assigned_from,
      assigned_to,
      assigned_by,
      assignment_type,
      time_to_assign_seconds,
      tenant_id  -- CORREÇÃO: Incluir tenant_id explícito
    )
    VALUES (
      NEW.contact_id,
      NEW.id,
      OLD.assigned_to,
      NEW.assigned_to,
      auth.uid(),  -- Pode ser NULL quando executado sem usuário
      v_assignment_type,
      v_time_to_assign,
      NEW.tenant_id  -- Pegar tenant_id da conversa que está sendo atualizada
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

## Resultado

| Cenário | Antes | Depois |
|---------|-------|--------|
| SQL direto no Supabase | Erro P0001: tenant_id obrigatório | Funciona (pega tenant da conversa) |
| Edge Function com service_role | Erro P0001 | Funciona |
| Usuário autenticado no app | Funciona | Continua funcionando |

## Após a Correção

Executar o SQL de sincronização das 92 conversas órfãs:

```sql
UPDATE conversations cv
SET 
  assigned_to = con.assigned_to,
  updated_at = now()
FROM contacts con
WHERE cv.contact_id = con.id
  AND cv.status IN ('open', 'pending')
  AND cv.assigned_to IS NULL
  AND con.assigned_to IS NOT NULL;
```

## Arquivo Afetado

- **1 nova migration SQL** no banco de dados
