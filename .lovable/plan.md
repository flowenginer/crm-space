
# Problema: Conexões Ausentes no Fluxo "EMPREGA MAIS - PROTOCOLO AGENDAMENTO"

## Diagnóstico

Ao analisar o banco de dados, descobri que o fluxo **"EMPREGA MAIS - PROTOCOLO AGENDAMENTO"** perdeu todas as suas conexões:

| Fluxo | Total de Nós | Total de Conexões | Status |
|-------|--------------|-------------------|--------|
| EMPREGA MAIS - PALESTRA | 3 | 2 | ✅ OK |
| EMPREGA MAIS - POS VISITA | 3 | 2 | ✅ OK |
| **EMPREGA MAIS - PROTOCOLO AGENDAMENTO** | **3** | **0** | ❌ ERRO |
| EMPREGA MAIS - TREINAMENTO | 3 | 2 | ✅ OK |

### O que aconteceu

1. O fluxo tem 3 nós:
   - `trigger (message_key)` - Palavra-chave: "Registro de Cadastramento"
   - `action (add_tag)` - Adiciona tag
   - `action (set_lead_status)` - Define status: "Agendado"

2. **Não existem conexões entre esses nós** - as "linhas" que ligam um bloco ao outro foram apagadas

3. O fluxo funcionou até 31/01/2026 (há logs mostrando "Status alterado para: Agendado")

4. Após essa data, mesmo que o trigger seja acionado, nada acontece porque não há conexão para o próximo nó

---

## Solução

### Opção 1: Recriar as conexões via SQL (Rápido)

Inserir as conexões diretamente no banco:

```sql
-- Conexão: trigger → add_tag
INSERT INTO flow_connections (flow_id, source_node_id, target_node_id)
VALUES (
  'f2260719-fcf9-4b09-85ed-b13e733b29fd',  -- flow_id
  '45d60eb4-2961-43cc-8f3c-62ae56c5d8d3',  -- trigger (message_key)
  'df0ce31e-99c8-4dc4-ac1d-9f07be65c2dd'   -- add_tag
);

-- Conexão: add_tag → set_lead_status  
INSERT INTO flow_connections (flow_id, source_node_id, target_node_id)
VALUES (
  'f2260719-fcf9-4b09-85ed-b13e733b29fd',  -- flow_id
  'df0ce31e-99c8-4dc4-ac1d-9f07be65c2dd',  -- add_tag
  'ac22c650-48e7-4c09-828d-68e5464ad862'   -- set_lead_status
);
```

### Opção 2: Reconectar no Flow Builder (Manual)

O usuário pode abrir o fluxo no Flow Builder e arrastar as conexões novamente.

---

## Ação Recomendada

Executar a **Opção 1** (inserir conexões via SQL) para restaurar imediatamente o funcionamento do fluxo.

---

## Seção Técnica

### IDs dos Nós do Fluxo

| Nó | Subtipo | ID |
|----|---------|----| 
| Trigger | message_key | `45d60eb4-2961-43cc-8f3c-62ae56c5d8d3` |
| Action 1 | add_tag | `df0ce31e-99c8-4dc4-ac1d-9f07be65c2dd` |
| Action 2 | set_lead_status | `ac22c650-48e7-4c09-828d-68e5464ad862` |

### Fluxo Esperado

```text
┌─────────────────────────────┐
│  Trigger: "Registro de      │
│  Cadastramento"             │
│  (message_key)              │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│  Adicionar Tag              │
│  (add_tag)                  │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│  Definir Status: "Agendado" │
│  (set_lead_status)          │
└─────────────────────────────┘
```
