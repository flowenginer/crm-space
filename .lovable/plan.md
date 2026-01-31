
# Comparacao de Dados e Ativacao/Desativacao por Campo

## Objetivo

Melhorar o preview da atualizacao em massa para:

1. **Exibir dados do sistema abaixo de cada linha importada** - permitindo comparacao visual
2. **Corrigir problema da quantidade** - que esta exibindo "-" mesmo quando existe valor na planilha
3. **Permitir ativar/desativar campos individualmente** - para cada linha, o usuario pode escolher quais campos atualizar

---

## Problema Identificado: Quantidade

Analisando o codigo, a funcao `parseQuantity` esta correta, mas o problema pode estar no mapeamento automatico. A coluna "Qtd" do Bling pode nao estar sendo detectada. Vou revisar e garantir que:
- O auto-mapping reconheca "Qtd" exatamente (case insensitive)
- O valor seja exibido corretamente na tabela

---

## Nova Interface do Preview

```text
┌────────────────────────────────────────────────────────────────────────────────┐
│  PREVIEW                                                                       │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  ┌──────────────────────────────────────────────────────────────────────────┐ │
│  │ ✓ 559899122...  │ CLIENTE X       │ R$ 1.798  │ 22   │ Scarlet          │ │
│  │   Sistema:       │ Cliente Teste   │ R$ 500    │ 10   │ Yasmin           │ │
│  │   Atualizar:     │ [✓] Nome        │ [✓] Valor │ [✓]  │ [✓] Vendedor     │ │
│  └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                                │
│  ┌──────────────────────────────────────────────────────────────────────────┐ │
│  │ ✓ 559898149...  │ CLIENTE Y       │ R$ 849    │ 10   │ Yasmin           │ │
│  │   Sistema:       │ Cliente Y Real  │ R$ 849    │ 10   │ Yasmin           │ │
│  │   Atualizar:     │ [ ] Nome        │ [ ] Valor │ [ ]  │ [ ] Vendedor     │ │
│  │   (valores iguais - desmarcados automaticamente)                         │ │
│  └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                                │
└────────────────────────────────────────────────────────────────────────────────┘
```

---

## Alteracoes Necessarias

### 1. Hook `useBulkLeadUpdate.ts`

**Expandir dados buscados do sistema**

Modificar a funcao `processAndMatch` para trazer mais campos do contato:

```typescript
interface MatchedRow extends BulkUpdateRow {
  // ... campos existentes ...
  
  // NOVOS: Dados atuais do sistema para comparacao
  currentValue: number | null;       // negotiated_value atual
  currentQuantity: number | null;    // shirt_quantity atual
  currentLeadStatus: string | null;  // lead_status atual
  currentAssigneeName: string | null; // nome do vendedor atual
  
  // NOVOS: Controle por campo
  updateFields: {
    value: boolean;
    quantity: boolean;
    status: boolean;
    assignee: boolean;
  };
}
```

Modificar query para trazer os campos adicionais:

```sql
SELECT 
  id, phone, full_name, assigned_to,
  negotiated_value, shirt_quantity, lead_status
FROM contacts
WHERE tenant_id = ? AND phone IN (...)
```

---

### 2. Componente `BulkUpdatePreview.tsx`

**Nova estrutura da tabela**

Para cada linha da planilha, exibir:
- **Linha 1**: Dados importados (planilha)
- **Linha 2**: Dados atuais (sistema) - com cor diferente para destacar diferencas
- **Linha 3**: Checkboxes individuais para ativar/desativar atualizacao de cada campo

**Logica de auto-deteccao de diferencas**

Quando os valores sao iguais:
- Desmarcar automaticamente o checkbox (nao precisa atualizar)
- Exibir com cor mais suave/verde

Quando os valores sao diferentes:
- Marcar automaticamente o checkbox
- Destacar em amarelo/laranja para chamar atencao

**Novo estado para controle por linha**

```typescript
const [rowSettings, setRowSettings] = useState<Map<number, {
  updateValue: boolean;
  updateQuantity: boolean;
  updateStatus: boolean;
  updateAssignee: boolean;
}>>(new Map());
```

---

### 3. Correcao do Parse de Quantidade

Revisar `autoMapBlingColumns` para garantir que "Qtd" seja mapeado:

```typescript
// Quantidade - adicionar mais variações
if (lower === 'qtd' || lower === 'qtde' || lower.includes('quantidade') || lower.includes('qty')) {
  mapping.qtdCamisas = h;
}
```

---

## Fluxo Atualizado

```text
1. Usuario faz upload da planilha
                    │
                    ▼
2. Sistema faz auto-mapping das colunas
                    │
                    ▼
3. Usuario clica "Buscar Contatos"
                    │
                    ▼
4. Sistema busca contatos E seus dados atuais
                    │
                    ▼
5. Preview exibe:
   - Dados da planilha
   - Dados do sistema (para comparacao)
   - Checkboxes por campo (pre-marcados se diferente)
                    │
                    ▼
6. Usuario ajusta checkboxes conforme necessario
                    │
                    ▼
7. Sistema atualiza apenas campos ativados de cada linha
```

---

## Detalhes de Implementacao

### Cores de Comparacao

| Situacao | Cor da Linha Sistema | Checkbox |
|----------|---------------------|----------|
| Valor diferente | Amarelo claro | Marcado |
| Valor igual | Verde claro | Desmarcado |
| Campo vazio no sistema | Cinza | Marcado |
| Campo vazio na planilha | - | Desabilitado |

### Atualizacao Final

Ao processar, para cada linha verificar os checkboxes individuais em vez das opcoes globais:

```typescript
// Para cada linha
if (row.updateFields.value && row.valorNegociado !== undefined) {
  updateData.negotiated_value = row.valorNegociado;
}
if (row.updateFields.quantity && row.qtdCamisas !== undefined) {
  updateData.shirt_quantity = row.qtdCamisas;
}
// ... etc
```

---

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/hooks/useBulkLeadUpdate.ts` | Expandir MatchedRow com dados do sistema, adicionar campo updateFields, corrigir auto-mapping |
| `src/components/bulk-update/BulkUpdatePreview.tsx` | Nova UI com linha de comparacao e checkboxes por campo |

---

## Resumo

Esta melhoria permitira que voce:

1. **Veja lado a lado** o que vem na planilha vs o que esta no sistema
2. **A quantidade funcionara** - vou corrigir o parse/mapping
3. **Desative campos individualmente** - se o valor ja esta certo, so desmarcar o checkbox daquela linha
4. **Atualize apenas o necessario** - so os campos marcados serao atualizados
