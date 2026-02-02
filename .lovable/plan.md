
# Correção: Tags Bloqueadas para Usuários (Erro RLS)

## Problema Identificado

Os usuários Beatriz, Rainy, Bruna, Susana e Nadia estão recebendo erro ao tentar aplicar etiquetas nos leads.

**Erro exato dos logs do banco:**
```
new row violates row-level security policy "Tenant isolation for contact_tags" for table "contact_tags"
```

### Causa Raiz

| Componente | Status | Problema |
|------------|--------|----------|
| Tabela `contact_tags` | `tenant_id` tem DEFAULT `'00000000-...-000001'` | Valor placeholder não combina com tenant real |
| Trigger | **NÃO EXISTE** | Deveria existir um trigger para preencher `tenant_id` |
| Política RLS | Exige `tenant_id = get_user_tenant_id()` | Bloqueia porque o valor inserido não combina |
| Código frontend | Não envia `tenant_id` (usa `as any`) | Depende de trigger que não existe |

### Fluxo do Erro

```text
1. Usuário clica em "Adicionar etiqueta"
2. Código faz: upsert({ contact_id, tag_id } as any)
3. tenant_id fica = '00000000-0000-0000-0000-000000000001' (DEFAULT da coluna)
4. RLS verifica: tenant_id == get_user_tenant_id()
5. '00000000-...-01' != '664dfcb4-...' (tenant Master)
6. ERRO: "violates row-level security policy"
```

---

## Solução

Há duas abordagens possíveis:

### Opção A: Criar Trigger (Recomendada)

Criar um trigger na tabela `contact_tags` que preenche automaticamente o `tenant_id` do usuário antes do INSERT.

**Vantagens:**
- Centraliza a lógica no banco
- Não precisa alterar código frontend
- Mais seguro (não depende do frontend)

### Opção B: Enviar tenant_id no Código

Modificar todos os locais que fazem INSERT/UPSERT em `contact_tags` para incluir o `tenant_id`.

**Desvantagens:**
- Precisa alterar vários arquivos
- Mais propenso a erros se esquecer em algum lugar

---

## Plano de Implementação (Opção A)

### 1. Migração SQL

Criar trigger `set_contact_tags_tenant_id` que usa a função existente `set_tenant_id_from_user`:

```sql
-- Criar trigger para preencher tenant_id automaticamente
CREATE TRIGGER set_contact_tags_tenant_id
BEFORE INSERT OR UPDATE ON contact_tags
FOR EACH ROW
EXECUTE FUNCTION set_tenant_id_from_user();
```

Também precisa ajustar o DEFAULT da coluna para NULL, para que o trigger saiba que precisa preencher:

```sql
-- Remover o default placeholder problemático
ALTER TABLE contact_tags 
ALTER COLUMN tenant_id DROP DEFAULT;
```

### 2. Nenhuma Alteração de Código Necessária

O código já está preparado para funcionar com o trigger (envia sem `tenant_id` e espera que o banco preencha).

---

## Arquivos a Modificar

| Tipo | Arquivo/Local | Alteração |
|------|---------------|-----------|
| SQL Migration | Nova migração | Criar trigger + remover DEFAULT problemático |

---

## Resultado Esperado

Após a migração:
- Beatriz, Rainy, Bruna, Susana e Nadia poderão aplicar etiquetas normalmente
- O `tenant_id` será preenchido automaticamente pelo trigger
- A política RLS passará porque `tenant_id` agora será igual ao do usuário

---

## Seção Técnica

### Usuárias Afetadas (confirmado no banco)

| Nome | Email | Tenant |
|------|-------|--------|
| Beatriz | atendente3@master.com.br | Master (664dfcb4-...) |
| Bruna | atendente4@master.com.br | Master (664dfcb4-...) |
| Nadia | atendente2@master.com.br | Master (664dfcb4-...) |
| Rainy | atendente1@master.com.br | Master (664dfcb4-...) |
| Susana | atendente5@master.com.br | Master (664dfcb4-...) |

### Políticas RLS Atuais da Tabela `contact_tags`

| Política | Comando | Condição |
|----------|---------|----------|
| Authenticated access contact_tags | ALL | `auth.uid() IS NOT NULL` |
| Authenticated users can create contact_tags | INSERT | `auth.uid() IS NOT NULL` |
| Tenant isolation for contact_tags | ALL | `tenant_id = get_user_tenant_id()` |

### Função set_tenant_id_from_user (já existe)

```sql
-- Esta função já existe e funciona corretamente
-- Ela pega o tenant_id do usuário autenticado via get_user_tenant_id()
-- Se tenant_id já foi fornecido, mantém o valor
-- Se não, preenche com o tenant do usuário
```

### Tabelas com Trigger Similar (referência)

Verificar se outras tabelas como `contacts`, `conversations`, `tags` também têm ou precisam deste trigger.
