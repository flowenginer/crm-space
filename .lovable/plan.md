
# Diagnóstico: Discrepância entre Atribuição de Conversa e Contato

## Problema Identificado

A Susana vê um lead na aba "Minhas" mas o sistema mostra que está atribuído a Bruna. Esta situação ocorre devido a uma **dessincronização estrutural** entre dois campos diferentes:

| Campo | Localização | Significado |
|-------|-------------|-------------|
| `conversations.assigned_to` | Tabela de conversas | Quem está atendendo a conversa atual |
| `contacts.assigned_to` | Tabela de contatos | Quem é o "dono" permanente do contato |

---

## Causa Raiz

A função `transfer_conversation` foi projetada para **preservar o responsável original do contato**:

```sql
-- Código atual na função transfer_conversation
assigned_to = CASE 
  WHEN assigned_to IS NULL AND p_to_user_id IS NOT NULL THEN p_to_user_id 
  ELSE assigned_to  -- NÃO MUDA se já tem dono
END
```

Isso significa:
- Quando uma conversa é transferida para Bruna, `conversations.assigned_to = Bruna` ✓
- Mas se o contato já tinha Susana como responsável, `contacts.assigned_to` permanece Susana ✗

### Cenário que cria o problema

```text
1. Contato "Sheila" atribuído a Susana (contacts.assigned_to = Susana)
2. Admin faz "Distribuição em massa" para Bruna
3. Conversa é transferida (conversations.assigned_to = Bruna)
4. Contato NÃO é atualizado (contacts.assigned_to = Susana)
```

### Dados Atuais

| Métrica | Valor |
|---------|-------|
| Total de conversas ativas (Master) | 1.536 |
| Conversas com discrepância | 112 (7,3%) |
| Conversas com agente mas contato sem | 25 |
| Conversas sem agente mas contato com | 10 |

---

## Por que Space Sports não tem este problema?

A Space Sports **não usa a funcionalidade de "Distribuição em massa"** e não transfere leads entre vendedores com frequência. Portanto, a dessincronização não ocorre.

---

## O que a UI mostra

A interface exibe **ambos os campos** em lugares diferentes:

| Local na UI | Campo usado | Significado |
|-------------|-------------|-------------|
| Aba "Minhas" (filtro) | `conversations.assigned_to` | Quem está atendendo |
| Badge azul na lista | `conversations.assignee` | Quem está atendendo |
| Sidebar "Atendente Responsável" | `contacts.assigned_to` | Dono permanente |

**O problema visual**: O usuário vê a conversa na sua aba "Minhas", mas quando abre o sidebar vê outro nome como "Responsável".

---

## Soluções Propostas

### Opção A: Sincronização Total (Recomendada)

Modificar a função `transfer_conversation` para **sempre sincronizar** ambos os campos quando uma transferência é feita:

```sql
-- Nova lógica: sempre sincronizar contato com conversa
UPDATE contacts
SET 
  assigned_to = p_to_user_id,  -- SEMPRE atualiza
  department_id = COALESCE(v_final_department_id, department_id),
  updated_at = NOW()
WHERE id = v_contact_id;
```

**Vantagens:**
- Consistência total entre conversa e contato
- Usuário vê o mesmo nome em todos os lugares
- Relatórios de performance ficam consistentes

**Desvantagens:**
- Perde o conceito de "dono original do contato"
- Pode afetar métricas de primeiro atendente

### Opção B: Manter Lógica Atual + Corrigir Dados Existentes

1. **Não alterar a função** (manter comportamento atual)
2. **Rodar script de sincronização** para corrigir os 112 casos existentes
3. **Documentar** que "Atendente Responsável" é diferente de "Atendente Atual"

```sql
-- Script de sincronização
UPDATE contacts con
SET assigned_to = c.assigned_to, updated_at = now()
FROM conversations c
WHERE c.contact_id = con.id
  AND c.status IN ('open', 'pending')
  AND c.assigned_to IS NOT NULL
  AND con.assigned_to != c.assigned_to
  AND c.tenant_id = '664dfcb4-5432-4c14-9838-7db14360cabf';
```

### Opção C: Clarificar na UI

Não alterar o backend, mas **melhorar os rótulos** na interface:

- Mudar "Atendente Responsável" para "Dono do Contato"
- Adicionar tooltip explicando a diferença
- Mostrar ambos os campos claramente

---

## Recomendação

**Opção A (Sincronização Total)** é a mais adequada para o modelo de negócio da Master, onde leads são redistribuídos frequentemente e o conceito de "dono original" não é relevante.

Isso requer:
1. Atualizar a função `transfer_conversation`
2. Rodar script de correção nos dados existentes
3. Atualizar a função `update_conversation_assignment`

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| Nova migration SQL | Atualizar função `transfer_conversation` para sempre sincronizar |
| Nova migration SQL | Atualizar função `update_conversation_assignment` para sempre sincronizar |
| Script one-time | Corrigir os 112 registros dessincronizados |

---

## Qual opção você prefere?

1. **Opção A** - Sincronização total (sempre atualizar contato junto com conversa)
2. **Opção B** - Manter lógica atual + corrigir dados + documentar diferença
3. **Opção C** - Apenas clarificar na UI sem alterar backend
