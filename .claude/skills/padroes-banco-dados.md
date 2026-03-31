---
name: padroes-banco-dados
description: Auditoria completa de banco de dados — modelagem, queries, FKs, indices, RLS e escalabilidade. Retorna sumario estruturado com vulnerabilidades e table scans desnecessarios.
---

# Skill: Padroes de Banco de Dados

Voce eh o agente `@db` executando uma auditoria rigorosa do banco de dados. Siga TODAS as regras abaixo sem excecao. Ao final, retorne o sumario estruturado obrigatorio.

## Contexto

- **Supabase Project ID:** `lkxrmjqrzhaivviuuamp`
- **Schema doc:** `docs/API.md` (contém info de DB), nao existe docs/DB.md dedicado
- **Docs complementares:** `docs/ANALISE_TECNICA_CRM.md`, `docs/LEAD_DATA_ARCHITECTURE.md`, `docs/MIGRACAO_MULTI_TENANCY.md`
- **Types:** `src/integrations/supabase/types.ts` (~400KB)
- **157 tabelas**, 63 Edge Functions
- **Multi-tenant via tenant_id** (143 tabelas)
- **5 tabelas sem RLS:** conversation_analysis, lead_analysis, pedidos_status, sync_vendas_log, token_bling
- **Tabelas-chave:** tenants, profiles, contacts, conversations, messages, whatsapp_channels, deals, chatbot_flows, flow_nodes, campaigns, lead_scores

## Ferramentas

- `mcp__up-supa__execute_sql` — queries diagnosticas
- `mcp__up-supa__apply_migration` — aplicar DDL
- `mcp__up-supa__get_advisors` — lint rules do Supabase
- `mcp__up-supa__list_tables` — listar tabelas

---

## REGRAS ESTRITAS DE MODELAGEM

### 1. Tipos de Dados
- **OBRIGATORIO** `uuid` para toda PK (usar `gen_random_uuid()`)
- **OBRIGATORIO** `timestamptz` para datas — NUNCA `timestamp` sem timezone
- **OBRIGATORIO** `text` para strings — NUNCA `varchar(n)` (habito MySQL sem beneficio no PG)
- **OBRIGATORIO** `numeric(12,2)` para valores monetarios — NUNCA `money` type, NUNCA `float`
- **OBRIGATORIO** `boolean` com DEFAULT explicito — NUNCA deixar nullable sem razao
- **OBRIGATORIO** `GENERATED ALWAYS AS IDENTITY` para sequenciais — NUNCA `serial`
- **PROIBIDO** `json` — usar `jsonb` (indexavel, operadores eficientes)

### 2. Nomenclatura
- Tabelas: `snake_case` plural (`contacts`, `messages`, `chatbot_flows`)
- Colunas: `snake_case` (`created_at`, `tenant_id`, `whatsapp_message_id`)
- Constraints: `tabela_coluna_tipo` (`contacts_tenant_id_fkey`, `deals_stage_check`)
- Indices: `idx_tabela_colunas` (`idx_messages_conversation_id`, `idx_contacts_tenant_phone`)

### 3. Constraints Obrigatorias
- Toda tabela DEVE ter `PRIMARY KEY`
- Toda tabela DEVE ter `created_at timestamptz DEFAULT now()`
- Tabelas mutaveis DEVEM ter `updated_at timestamptz DEFAULT now()` + trigger `update_updated_at_column()`
- Toda relacao DEVE ter `FOREIGN KEY` explicita com `ON DELETE` definido
- Campos com dominio finito DEVEM usar `CHECK` ou enum

### 4. Multi-Tenant
- Toda tabela com dados de usuario DEVE ter coluna `tenant_id uuid NOT NULL REFERENCES tenants(id)`
- NUNCA confiar na aplicacao para filtrar por tenant — RLS eh obrigatorio
- tenant_id DEVE ser a primeira coluna em indices compostos relevantes
- **143 de 157 tabelas** ja tem tenant_id — as restantes sao tabelas de sistema/config

---

## REGRAS ESTRITAS DE FOREIGN KEYS E INDICES

### Foreign Keys
- Toda FK DEVE ter indice correspondente na coluna referenciadora
- PostgreSQL NAO cria indice automatico em colunas FK (apenas na PK referenciada)
- FK sem indice = sequential scan na tabela filha durante DELETE no pai (pode ser 100-500x mais lento)

### Deteccao de FKs sem Indice
Executar SEMPRE esta query ao auditar:
```sql
SELECT
  c.conrelid::regclass AS tabela,
  a.attname AS coluna,
  c.conname AS constraint_name
FROM pg_constraint c
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
WHERE c.contype = 'f'
AND NOT EXISTS (
  SELECT 1 FROM pg_index i
  WHERE i.indrelid = c.conrelid
  AND a.attnum = ANY(i.indkey)
)
ORDER BY tabela;
```
**Severidade: CRITICAL** — toda FK sem indice deve ser corrigida imediatamente.

### Estrategia de Indices
- **B-tree** (padrao): igualdade e range. Ordem importa: igualdade primeiro, range por ultimo
- **GIN**: JSONB (`@>`), arrays (`&&`), full-text search (busca de contatos/mensagens)
- **BRIN**: dados append-only ordenados (messages, conversations — indice minusculo)
- **Partial**: indexar apenas subset relevante (`WHERE status = 'pending'`, `WHERE is_active = true`)
- **Covering (INCLUDE)**: evitar acesso a heap (`CREATE INDEX ON t(a) INCLUDE (b, c)`)

### Anti-Patterns de Indice
- **PROIBIDO** indice em coluna boolean com poucos valores distintos (planner ignora)
- **PROIBIDO** indice duplicado (mesmo conjunto de colunas em ordem diferente sem justificativa)
- **PROIBIDO** indice nao utilizado — verificar `pg_stat_user_indexes` e remover

---

## REGRAS ESTRITAS DE OTIMIZACAO DE QUERIES

### Obrigacoes
- **NUNCA** `SELECT *` — sempre especificar colunas
- **NUNCA** query sem `LIMIT` em endpoints de API (maximo 1000)
- **NUNCA** `OFFSET` para paginacao em tabelas grandes — usar keyset: `WHERE id > $last_id ORDER BY id LIMIT 20`
- **NUNCA** funcao na coluna indexada no WHERE (`WHERE lower(email) = 'x'`) sem expression index
- **NUNCA** `NOT IN` com subquery que pode conter NULL — usar `NOT EXISTS`
- **NUNCA** `BETWEEN` com timestamps — usar `>= AND <`
- **OBRIGATORIO** parametros (`$1`, `$2`) em queries — NUNCA string concatenation

### Queries Criticas do CRM
```sql
-- Busca de contatos por tenant (hot path)
-- DEVE ter indice: idx_contacts_tenant_id ou idx_contacts_tenant_phone
SELECT id, name, phone, email, tags, last_message_at
FROM contacts
WHERE tenant_id = $1
ORDER BY last_message_at DESC
LIMIT 50;

-- Mensagens de uma conversa (hot path — pode ter milhares)
-- DEVE ter indice: idx_messages_conversation_id_created_at
SELECT id, content, sender_type, media_url, created_at
FROM messages
WHERE conversation_id = $1
ORDER BY created_at DESC
LIMIT 50;

-- Deals por pipeline/stage (dashboard)
-- DEVE ter indice: idx_deals_tenant_id_pipeline_id_stage
SELECT id, title, value, stage, contact_id
FROM deals
WHERE tenant_id = $1 AND pipeline_id = $2
ORDER BY position;
```

### Diagnostico com EXPLAIN ANALYZE
Usar `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)` para toda query suspeita:
- `Seq Scan` em tabela > 1000 rows = provavelmente falta indice
- `actual rows` vs `rows` estimado divergindo > 10x = rodar `ANALYZE tabela`
- `shared read` alto vs `shared hit` = tabela grande demais para cache
- `Nested Loop` com muitas rows = possivel N+1

### Deteccao de Table Scans Desnecessarios
```sql
SELECT relname, seq_scan, idx_scan,
  seq_scan - idx_scan AS seq_excess,
  n_live_tup AS rows
FROM pg_stat_user_tables
WHERE seq_scan > idx_scan AND n_live_tup > 1000
ORDER BY seq_excess DESC;
```

### Deteccao de Indices Nao Utilizados
```sql
SELECT schemaname, relname, indexrelname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0 AND schemaname = 'public'
ORDER BY relname;
```

---

## REGRAS ESTRITAS DE RLS (Row Level Security)

### Obrigacoes
- **TODA tabela no schema public DEVE ter RLS habilitado** — sem excecao
- **5 tabelas conhecidas sem RLS:** conversation_analysis, lead_analysis, pedidos_status, sync_vendas_log, token_bling — DEVEM ser corrigidas
- **TODA tabela com dados de usuario DEVE ter policies** para SELECT, INSERT, UPDATE, DELETE
- **Policies DEVEM usar `(SELECT auth.uid())` com wrapper SELECT** para initPlan caching (100x+ mais rapido)
- **Policies multi-tenant DEVEM filtrar por tenant_id** via `get_user_tenant_id()` ou funcao equivalente
- **INSERT policies DEVEM ter WITH CHECK** prevenindo insercao em tenant alheio
- **UPDATE policies DEVEM ter WITH CHECK** prevenindo escalacao de role

### Otimizacao de RLS
```sql
-- RUIM (avalia por row):
CREATE POLICY "read" ON contacts FOR SELECT USING (tenant_id = get_user_tenant_id());

-- BOM (avalia uma vez via initPlan):
CREATE POLICY "read" ON contacts FOR SELECT USING (tenant_id = (SELECT get_user_tenant_id()));
```

### Security Definer para Checks Complexos
```sql
CREATE OR REPLACE FUNCTION user_tenant_id() RETURNS uuid AS $$
  SELECT tenant_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

### Anti-Patterns de RLS
- **PROIBIDO** `USING (true)` em tabelas com dados de usuario
- **PROIBIDO** `auth.role() = 'authenticated'` como unica verificacao (qualquer user logado acessa tudo)
- **PROIBIDO** confiar em `user_metadata` para policies (usuario pode modificar)
- **PROIBIDO** Views sem `security_invoker = true` (bypassam RLS por padrao)

### Auditoria de RLS
```sql
-- Tabelas SEM RLS habilitado
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
AND tablename NOT IN (
  SELECT tablename FROM pg_tables t
  JOIN pg_class c ON c.relname = t.tablename
  WHERE c.relrowsecurity = true
);

-- Tabelas COM RLS mas SEM policies
SELECT c.relname FROM pg_class c
WHERE c.relrowsecurity = true
AND c.relnamespace = 'public'::regnamespace
AND NOT EXISTS (
  SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid
);
```

---

## ANALISE DE ESCALABILIDADE

### Verificacoes Obrigatorias
1. **Volume projetado:** Estimar crescimento por tabela (rows/mes) — messages e conversations crescem mais rapido
2. **Queries mais frequentes:** Identificar hot paths (busca contatos, carregar mensagens, dashboard deals)
3. **Tabelas quentes:** messages, conversations, contacts — muitos INSERT/UPDATE, precisam autovacuum agressivo
4. **Connection pooling:** Verificar se Supavisor esta sendo usado corretamente — 63 Edge Functions competindo
5. **Materialized views:** Para dashboards com aggregacoes (lead_scores, campaign metrics), considerar views materializadas
6. **Particionamento:** messages e conversations sao candidatas a particionamento por tenant_id ou created_at quando crescerem

### Metricas a Coletar
```sql
-- Cache hit ratio (ideal > 0.99)
SELECT sum(heap_blks_hit) / nullif(sum(heap_blks_hit) + sum(heap_blks_read), 0) AS ratio
FROM pg_statio_user_tables;

-- Tabelas com mais dead tuples (precisam vacuum)
SELECT relname, n_dead_tup, n_live_tup,
  round(n_dead_tup::numeric / greatest(n_live_tup, 1) * 100, 2) AS dead_pct
FROM pg_stat_user_tables WHERE n_dead_tup > 100 ORDER BY dead_pct DESC;

-- Tamanho das tabelas
SELECT relname, pg_size_pretty(pg_total_relation_size(relid)) AS total_size
FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC;
```

### Autovacuum para Tabelas Quentes
```sql
-- Configurar vacuum mais agressivo para tabelas com muitos updates
ALTER TABLE messages SET (autovacuum_vacuum_scale_factor = 0.01);
ALTER TABLE conversations SET (autovacuum_vacuum_scale_factor = 0.01);
ALTER TABLE contacts SET (autovacuum_vacuum_scale_factor = 0.02);
ALTER TABLE deals SET (autovacuum_vacuum_scale_factor = 0.02);
```

---

## SUMARIO ESTRUTURADO OBRIGATORIO

Ao final de toda auditoria, retornar EXATAMENTE neste formato:

```
# Auditoria de Banco de Dados — [data]

## Resultado Geral: [OK / ATENCAO / CRITICO]

## Vulnerabilidades Encontradas

### CRITICAL
- [descricao] — Arquivo/Tabela: [ref] — Fix: [acao]

### HIGH
- [descricao] — Arquivo/Tabela: [ref] — Fix: [acao]

### MEDIUM
- [descricao] — Arquivo/Tabela: [ref] — Fix: [acao]

### LOW
- [descricao] — Arquivo/Tabela: [ref] — Fix: [acao]

## Table Scans Desnecessarios
| Tabela | Seq Scans | Idx Scans | Rows | Acao Recomendada |
|--------|-----------|-----------|------|------------------|

## Foreign Keys sem Indice
| Tabela | Coluna | Constraint | Fix |
|--------|--------|-----------|-----|

## RLS Status
| Tabela | RLS Habilitado | Policies | Status |
|--------|---------------|----------|--------|

## Indices Nao Utilizados
| Tabela | Indice | Scans | Acao |
|--------|--------|-------|------|

## Metricas de Saude
- Cache hit ratio: [valor]
- Tabelas com dead tuples > 5%: [lista]
- Conexoes ativas: [valor]
- Maior tabela: [nome] ([tamanho])

## Recomendacoes de Escalabilidade
1. [recomendacao com justificativa]
2. [recomendacao com justificativa]

## Proximos Passos
1. [ ] [acao prioritaria 1]
2. [ ] [acao prioritaria 2]
3. [ ] [acao prioritaria 3]
```

---

## PROTOCOLO DE EXECUCAO

Quando esta skill for invocada:

1. Ler `docs/API.md` e docs complementares para entender schema atual
2. Executar `mcp__up-supa__get_advisors` para lint rules do Supabase
3. Rodar query de FKs sem indice
4. Rodar query de table scans desnecessarios
5. Rodar query de indices nao utilizados
6. Verificar RLS em todas as tabelas (especial atencao nas 5 conhecidas sem RLS)
7. Coletar metricas de saude (cache ratio, dead tuples, tamanho)
8. Analisar escalabilidade baseado no uso atual (foco em messages, conversations, contacts)
9. Gerar sumario estruturado obrigatorio
10. Listar acoes prioritarias ordenadas por severidade
