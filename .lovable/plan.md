
# Importacao de 92 Leads Perdidos — Canal EMPREGA-MAIS

## Contexto

Durante a interrupcao do dia 12/02/2026, aproximadamente 92 atendimentos do canal EMPREGA-MAIS nao foram registrados no banco de dados. O arquivo Excel exportado contem todos esses leads com nome, telefone, primeira mensagem e status.

## Situacao Atual no Banco

- **10 contatos** ja existem (por terem sido criados antes ou depois da interrupcao)
  - 9 desses ja possuem conversa no canal EMPREGA-MAIS
  - 1 (Jana - 5521976240806) existe mas sem conversa
- **82 contatos** nao existem e precisam ser criados do zero
- A maioria nao possui a primeira mensagem registrada

## Plano de Execucao

### Passo 1: Criar os 82 contatos novos

Inserir na tabela `contacts` com:
- `full_name`: nome do Excel
- `phone`: numero do contato
- `lead_status`: "Pre-contato" (quando indicado) ou NULL
- `tenant_id`: 664dfcb4-5432-4c14-9838-7db14360cabf
- `created_at`: 2026-02-12 (data da abertura)
- `contact_type`: "lead"

### Passo 2: Criar conversas para os 83 contatos sem conversa

Inserir na tabela `conversations` com:
- `contact_id`: ID do contato (novo ou existente)
- `channel_id`: ed6f2c8c-7339-4e92-8948-3f74baf280df (EMPREGA-MAIS)
- `status`: "open" (Pendente)
- `tenant_id`: 664dfcb4-5432-4c14-9838-7db14360cabf
- `created_at`: 2026-02-12
- `last_client_message_at`: 2026-02-12 (para ativar a janela 24h corretamente)
- `last_message_preview`: conteudo da primeira mensagem (truncado)

### Passo 3: Inserir a primeira mensagem de cada lead

Para cada conversa (nova e existente), inserir na tabela `messages`:
- `conversation_id`: ID da conversa
- `content`: texto da coluna "1a Mensagem" do Excel
- `is_from_me`: false (mensagem do cliente)
- `message_type`: "text"
- `status`: "received"
- `tenant_id`: 664dfcb4-5432-4c14-9838-7db14360cabf
- `created_at`: 2026-02-12

Obs: Leads sem primeira mensagem no Excel (4 registros) terao apenas o contato e conversa criados, sem mensagem.

### Passo 4: Atualizar last_client_message_at

Rodar UPDATE nas conversas recem-criadas para garantir que o campo `last_client_message_at` esteja correto (o trigger so funciona para novas mensagens futuras).

## Detalhes Tecnicos

A operacao sera feita via SQL direto (INSERT statements) em lotes, pois sao 92 registros. Serao usados CTEs (WITH) para encadear as operacoes de forma atomica:

```text
-- Pseudocodigo da abordagem:
-- 1. INSERT INTO contacts (...) VALUES (...) ON CONFLICT (phone, tenant_id) DO NOTHING RETURNING id, phone
-- 2. INSERT INTO conversations (...) SELECT ... FROM contacts_inseridos
-- 3. INSERT INTO messages (...) SELECT ... FROM conversas_inseridas
```

Os 10 contatos existentes serao tratados com `ON CONFLICT DO NOTHING` para evitar duplicatas. Para eles, a conversa e mensagem serao criadas apenas se ainda nao existirem.

## Volume

- ~82 INSERTs em contacts
- ~83 INSERTs em conversations
- ~88 INSERTs em messages (92 - 4 sem mensagem)
- ~83 UPDATEs em conversations (last_client_message_at)
