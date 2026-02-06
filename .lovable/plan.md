
# Correção URGENTE: Atendente Atual não preenchido na Distribuição

## Causa Raiz Identificada

O problema NAO e no codigo da Edge Function `distribute-lead` -- o `tenant_id` ja esta sendo passado corretamente. O problema e um **trigger do banco de dados** que cria um efeito cascata:

```text
distribute-lead faz UPDATE em conversations (com tenant_id) 
    --> trigger track_conversation_assignment dispara (BEFORE UPDATE OF assigned_to)
        --> INSERT em lead_assignment_history SEM tenant_id
            --> trigger set_tenant_id_from_user tenta resolver via auth.uid()
                --> auth.uid() = NULL (Service Role)
                    --> ERRO P0001: "tenant_id e obrigatorio"
                        --> UPDATE inteiro e REJEITADO
                            --> assigned_to NAO e atualizado
```

## Correção

Alterar a funcao `track_conversation_assignment` no banco de dados para incluir `NEW.tenant_id` no INSERT em `lead_assignment_history`.

### Antes (linha problemática):
```sql
INSERT INTO lead_assignment_history (
  contact_id, conversation_id, assigned_from, assigned_to, 
  assigned_by, assignment_type, time_to_assign_seconds
) VALUES (
  NEW.contact_id, NEW.id, OLD.assigned_to, NEW.assigned_to,
  auth.uid(), v_assignment_type, v_time_to_assign
);
```

### Depois (com tenant_id):
```sql
INSERT INTO lead_assignment_history (
  contact_id, conversation_id, assigned_from, assigned_to, 
  assigned_by, assignment_type, time_to_assign_seconds, tenant_id
) VALUES (
  NEW.contact_id, NEW.id, OLD.assigned_to, NEW.assigned_to,
  auth.uid(), v_assignment_type, v_time_to_assign, NEW.tenant_id
);
```

## Impacto

- Funciona para TODOS os tenants existentes (usa `NEW.tenant_id` dinamicamente)
- Funciona para futuros tenants (mesma logica)
- Nao quebra nenhum fluxo existente (apenas adiciona um campo que antes faltava)
- Resolve tanto a distribuicao automatica do departamento quanto a transferencia via automacao
