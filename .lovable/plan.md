
# Plano: Corrigir Conflito de Constraint na Cloud API

## Diagnóstico

O erro ocorre porque:

```text
┌─────────────────────────────────────────────────────────────────┐
│                     CENÁRIO DO PROBLEMA                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  TABELA cloudapi_configs:                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ tenant_id: Mi San    │ phone_number_id: 992057963984290  │   │
│  │ is_active: false     │ (registro antigo ainda existe)    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  CONSTRAINT: UNIQUE(tenant_id, phone_number_id)                 │
│                                                                 │
│  Usuário Mi San tenta cadastrar o MESMO número novamente:       │
│  → INSERT com tenant_id=Mi San + phone_number_id=992057...      │
│  → ERRO: duplicate key violates unique constraint               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

O hook atual apenas marca configurações antigas como `is_active: false`, mas **não remove o registro**. Quando o usuário tenta recadastrar o mesmo número, a constraint impede.

---

## Solução

Modificar o hook `useCreateCloudAPIConfig` para usar **upsert** (ON CONFLICT UPDATE) em vez de INSERT simples. Isso permitirá que o mesmo `phone_number_id` seja atualizado para o mesmo tenant.

### Mudança no Arquivo

**Arquivo:** `src/hooks/useCloudAPIConfig.ts`

**Lógica atual (problemática):**
```typescript
// Desativa configs anteriores (mas não remove)
await supabase
  .from('cloudapi_configs')
  .update({ is_active: false })
  .eq('tenant_id', tenantId);

// INSERT simples - falha se já existe
const { data, error } = await supabase
  .from('cloudapi_configs')
  .insert([insertData])
  .select()
  .single();
```

**Nova lógica (corrigida):**
```typescript
// Primeiro, desativar TODAS as configs do tenant
await supabase
  .from('cloudapi_configs')
  .update({ is_active: false })
  .eq('tenant_id', tenantId);

// Usar UPSERT com onConflict para atualizar se já existe
const { data, error } = await supabase
  .from('cloudapi_configs')
  .upsert(insertData, { 
    onConflict: 'tenant_id,phone_number_id',
    ignoreDuplicates: false 
  })
  .select()
  .single();
```

---

## Fluxo Corrigido

```text
┌─────────────────────────────────────────────────────────────────┐
│                     FLUXO APÓS CORREÇÃO                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Usuário Mi San cadastra phone_number_id: 992057...          │
│           ▼                                                     │
│  2. Hook desativa todas as configs do tenant Mi San             │
│           ▼                                                     │
│  3. Hook executa UPSERT:                                        │
│     - Se NÃO existe: INSERT novo registro                       │
│     - Se JÁ existe: UPDATE registro existente                   │
│           ▼                                                     │
│  4. Registro ativado com is_active: true → SUCESSO              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Por que isso também resolve para outros tenants?

A constraint permite o **mesmo phone_number_id em tenants DIFERENTES**. Então:

| Cenário | Resultado |
|---------|-----------|
| Mi San recadastra 992057... | UPSERT atualiza registro existente |
| Escola Master cadastra 992057... | INSERT cria novo registro (tenant diferente) |
| Space Sports cadastra 992057... | INSERT cria novo registro (tenant diferente) |

---

## Arquivo Modificado

| Arquivo | Ação |
|---------|------|
| src/hooks/useCloudAPIConfig.ts | Trocar INSERT por UPSERT na função useCreateCloudAPIConfig |

---

## Validação

Após a correção:
1. Usuário do Mi San consegue recadastrar o mesmo número
2. Usuários de outros tenants conseguem cadastrar qualquer número
3. Cada tenant mantém sua própria configuração isolada
