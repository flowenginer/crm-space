
# Corrigir Trigger de Gamificacao que Bloqueia Atualizacao de Status

## Problema Real Identificado

O erro **nao esta na edge function** (o codigo dela esta correto com `tenant_id`). O problema esta no trigger de banco `gamification_on_lead_status_change` que dispara **em cascata** quando o status do contato muda.

A cadeia do erro:

1. Edge function faz UPDATE em `contacts` com `tenant_id` (correto)
2. O AFTER UPDATE trigger `gamification_on_lead_status_change` dispara automaticamente
3. Esse trigger faz INSERT em `gamification_points` e `gamification_profiles` **sem incluir `tenant_id`**
4. As tabelas `gamification_points` e `gamification_profiles` possuem o trigger `set_tenant_id_from_user` (BEFORE INSERT)
5. Como a operacao vem de service role (edge function), `auth.uid()` retorna NULL
6. O trigger nao consegue determinar o tenant_id e lanca EXCEPTION
7. A excecao faz ROLLBACK de **toda a transacao**, incluindo o UPDATE original do contacts

Por isso a tag funciona (usa outra logica) mas o status falha - o trigger de gamificacao bloqueia tudo.

## Solucao

Alterar a funcao `gamification_on_lead_status_change` para incluir `NEW.tenant_id` nos INSERTs de `gamification_points` e `gamification_profiles`.

## Alteracao

### Migracao SQL

Recriar a funcao `gamification_on_lead_status_change` adicionando `tenant_id` nos dois INSERTs:

```sql
-- INSERT em gamification_points (adicionar tenant_id)
INSERT INTO gamification_points (user_id, points, action_type, reference_type, reference_id, description, tenant_id)
VALUES (v_assigned_user, v_points, 'status_change', 'contact', NEW.id, 
  'Mudanca para status: ' || NEW.lead_status, NEW.tenant_id);

-- INSERT/UPSERT em gamification_profiles (adicionar tenant_id)  
INSERT INTO gamification_profiles (user_id, total_points, total_points_alltime, tenant_id)
VALUES (v_assigned_user, v_points, v_points, NEW.tenant_id)
ON CONFLICT (user_id) DO UPDATE SET ...;
```

## Complexidade

**Baixa** - alterar 1 funcao de trigger no banco para incluir `NEW.tenant_id` em 2 operacoes INSERT. Nenhuma alteracao em codigo da edge function necessaria.
