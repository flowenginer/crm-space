
# Plano de Correção: Erro de Importação de Contatos

## Problema Identificado

A importação de 1629 contatos está falhando com 100% de erros porque:

**"duplicate key value violates unique constraint 'contacts_phone_tenant_unique'"**

### Causas

1. **Limite de 1000 registros do Supabase**: A query que busca contatos existentes usa `.in('phone', Array.from(allPhoneVariations))`, mas:
   - Para 1629 linhas, gera ~6000+ variações de telefone
   - O Supabase retorna **no máximo 1000 registros** por padrão
   - Resultado: Apenas ~1000 contatos existentes são encontrados
   - Os outros contatos são considerados "novos" e tentam INSERT

2. **Sem detecção de duplicatas internas**: Se a planilha tiver o mesmo telefone em múltiplas linhas, o código tenta inserir todos

---

## Solução

### 1. Dividir Query em Chunks

Em vez de fazer uma única query IN com milhares de variações, dividir em chunks de ~300 telefones:

```typescript
// Dividir variações em chunks para evitar limite do Supabase
const phoneChunks = chunkArray(Array.from(allPhoneVariations), 300);

for (const chunk of phoneChunks) {
  const { data } = await supabase
    .from('contacts')
    .select('id, full_name, phone, assigned_to, lead_status')
    .in('phone', chunk);
  
  data?.forEach(c => contactsCache.set(c.phone, c));
}
```

### 2. Detectar Duplicatas Internas

Antes de adicionar ao `contactsToCreate`, verificar se o telefone já foi processado:

```typescript
// Verificar se já processamos este telefone neste lote
if (processedContacts.has(normalizedPhone)) {
  importResult.log.push({
    type: 'warning',
    message: `Telefone duplicado na planilha: ${row.telefone}`,
    row: rowNum,
  });
  importResult.skipped++;
  continue;
}
```

### 3. Usar UPSERT em vez de INSERT

Mudar de `insert()` para `upsert()` com `onConflict` para que telefones duplicados sejam atualizados em vez de falhar:

```typescript
const { data: created, error } = await supabase
  .from('contacts')
  .upsert(batch, { onConflict: 'phone,tenant_id' })
  .select('id, phone');
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useImportContacts.ts` | Dividir query em chunks + detectar duplicatas + usar upsert |

---

## Resultado Esperado

- Contatos existentes serão corretamente identificados (não há mais limite de 1000)
- Telefones duplicados na planilha serão detectados e logados
- Em caso de duplicata residual, o upsert atualizará em vez de falhar
- Importação passará de 0% de sucesso para ~100%
