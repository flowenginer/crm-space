
# Plano: Corrigir Salvamento de Templates no Tenant Escola Master

## Diagnóstico Confirmado

O erro acontece devido a uma combinação de três fatores:

```text
┌─────────────────────────────────────────────────────────────────┐
│                     FLUXO DO PROBLEMA                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Frontend envia INSERT sem tenant_id                         │
│           ▼                                                     │
│  2. Banco aplica DEFAULT: '00000000...0001' (Space Sports)      │
│           ▼                                                     │
│  3. Trigger vê tenant_id != NULL → retorna sem alterar          │
│           ▼                                                     │
│  4. RLS WITH CHECK: tenant_id = get_user_tenant_id()            │
│           ▼                                                     │
│  5. FALHA: Space Sports != Escola Master                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Por que funciona no Space Sports?

O default aponta para Space Sports (`00000000-0000-0000-0000-000000000001`), então:
- Usuario Space Sports insere template
- Default aplica tenant_id = Space Sports  
- RLS verifica: Space Sports = Space Sports → OK

### Por que falha no Escola Master?

- Usuario Escola Master insere template
- Default aplica tenant_id = Space Sports (errado!)
- RLS verifica: Space Sports != Escola Master → BLOQUEADO

---

## Solucao

Remover o default da coluna `tenant_id` para que o trigger possa atribuir o tenant correto automaticamente.

### SQL da Migracao

```sql
-- Remover o default que esta causando o problema
ALTER TABLE public.message_templates 
ALTER COLUMN tenant_id DROP DEFAULT;
```

---

## Fluxo Corrigido

```text
┌─────────────────────────────────────────────────────────────────┐
│                     FLUXO CORRIGIDO                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Frontend envia INSERT sem tenant_id                         │
│           ▼                                                     │
│  2. tenant_id = NULL (sem default)                              │
│           ▼                                                     │
│  3. Trigger detecta NULL → busca tenant do usuario              │
│           ▼                                                     │
│  4. Trigger atribui: tenant_id = Escola Master                  │
│           ▼                                                     │
│  5. RLS WITH CHECK: Escola Master = Escola Master → OK          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tabelas Afetadas pela Mesma Correção

Alem de `message_templates`, as seguintes tabelas também têm o mesmo problema potencial e devem ter o default removido:

| Tabela | Default Atual |
|--------|---------------|
| message_templates | 00000000...0001 |
| template_folders | 00000000...0001 |
| user_quick_templates | 00000000...0001 |

---

## Arquivos Modificados

| Arquivo | Ação |
|---------|------|
| Nova migração SQL | Remover DEFAULT de tenant_id |

Nenhuma alteração no código frontend é necessária - o trigger já cuida de atribuir o tenant correto quando o default não interfere.

---

## Validação

Após aprovar a migração:
1. Usuario da Escola Master acessa Mensagens Rápidas
2. Grava um áudio ou digita uma mensagem
3. Clica em Criar Template
4. Template é criado com sucesso no tenant correto
