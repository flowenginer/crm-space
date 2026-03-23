

## Problema

O erro **"there is no unique or exclusion constraint matching the ON CONFLICT specification"** ocorre na Edge Function `instagram-oauth` (linha 248) ao tentar fazer `upsert` na tabela `instagram_configs` com `{ onConflict: 'tenant_id' }`. A tabela não possui um constraint UNIQUE na coluna `tenant_id`, então o Postgres rejeita o ON CONFLICT.

## Solução

Duas alterações necessárias:

### 1. Migração SQL: Adicionar constraint UNIQUE em `tenant_id`
Criar um índice unique na coluna `tenant_id` da tabela `instagram_configs` para permitir o upsert:
```sql
ALTER TABLE instagram_configs 
ADD CONSTRAINT instagram_configs_tenant_id_unique UNIQUE (tenant_id);
```

### 2. Edge Function: Ajustar lógica de save
Na função `instagram-oauth/index.ts`, na ação `save_account`:
- Antes de inserir um novo canal (`whatsapp_channels`), verificar se já existe um canal Instagram para o tenant e reutilizá-lo ou atualizá-lo, evitando duplicatas de canais a cada reconexão.

