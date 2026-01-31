
# Sistema de Atualizacao de Leads via PDF/Planilha do Bling

## Objetivo

Criar um sistema que permite importar PDFs ou planilhas de vendas do Bling e atualizar automaticamente:
- **Valor Negociado** (`negotiated_value`)
- **Qtd. Camisas** (`shirt_quantity`)
- **Status de Lead** para "07 - Pedido Fechado"
- **Vendedor/Agente responsavel** (`assigned_to` em contacts e conversations)

---

## Dados do PDF Analisado

O PDF "VENDAS_01-01_26" contém a seguinte estrutura:

| Campo no PDF | Campo no Sistema | Tipo |
|--------------|------------------|------|
| Celular / Telefone | `phone` (identificador) | texto |
| Qtd | `shirt_quantity` | inteiro |
| Total Pedido | `negotiated_value` | decimal |
| Vendedor | `assigned_to` | uuid (via mapeamento) |

### Mapeamento de Vendedores Identificados

| Nome no PDF | Perfil no Sistema | ID |
|-------------|-------------------|-----|
| SCARLET 07 | Scarlet Costa | `97ad6ef8-...` |
| YASMIM SANT´ANNA | Yasmin Sant'Anna | `62cf8e40-...` |

O sistema usara matching fuzzy existente para:
- Normalizar acentos (YASMIM → yasmin)
- Match por primeiro nome (SCARLET → scarlet costa)
- Ignorar sufixos numericos ("07")

---

## Arquitetura da Solucao

### Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `src/pages/BulkLeadUpdate.tsx` | Pagina dedicada para atualizacao em massa |
| `src/hooks/useBulkLeadUpdate.ts` | Hook com logica de processamento |
| `src/components/bulk-update/BulkUpdateUploader.tsx` | Componente de upload (PDF/Excel/CSV) |
| `src/components/bulk-update/BulkUpdatePreview.tsx` | Preview e mapeamento de colunas |
| `src/components/bulk-update/BulkUpdateResults.tsx` | Resultados da atualizacao |

### Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/App.tsx` | Adicionar rota `/leads/atualizacao` |
| `src/components/layout/MainSidebar.tsx` | Adicionar item no menu CRM |

---

## Fluxo do Sistema

```text
┌─────────────────────────────────────────────────────────────────┐
│  ETAPA 1: UPLOAD                                                │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  📄 Arraste seu arquivo aqui                              │ │
│  │  Formatos: PDF, Excel (.xlsx), CSV                        │ │
│  │                                                           │ │
│  │  [Escolher Arquivo]  [Colar Link Google Sheets]           │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  ETAPA 2: MAPEAMENTO AUTOMATICO                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Colunas detectadas:                                      │ │
│  │  "Celular" → Telefone ✓                                   │ │
│  │  "Qtd" → Quantidade de Camisas ✓                          │ │
│  │  "Total Pedido" → Valor Negociado ✓                       │ │
│  │  "Vendedor" → Agente Responsavel ✓                        │ │
│  │                                                           │ │
│  │  ☑ Atualizar para: "07 - Pedido Fechado"                 │ │
│  │  ☑ Atualizar vendedor do contato                         │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  ETAPA 3: PREVIEW                                               │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Leads encontrados: 5 de 5                                │ │
│  │                                                           │ │
│  │  Telefone       │ Valor    │ Qtd │ Vendedor   │ Status   │ │
│  │  559899122...   │ R$ 1.798 │ 22  │ Scarlet    │ ✓ Match  │ │
│  │  559898149...   │ R$ 849   │ 10  │ Yasmin     │ ✓ Match  │ │
│  │  559899731...   │ R$ 849   │ 10  │ Yasmin     │ ✓ Match  │ │
│  │  559898108...   │ R$ 1.145 │ 11  │ Scarlet    │ ✓ Match  │ │
│  │  559898282...   │ R$ 756   │ 9   │ Yasmin     │ ✓ Match  │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  [Atualizar 5 Leads]                                            │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  ETAPA 4: RESULTADO                                             │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  ✅ 5 leads atualizados com sucesso!                      │ │
│  │                                                           │ │
│  │  Resumo:                                                  │ │
│  │  • Valor total: R$ 5.397,00                               │ │
│  │  • Total de camisas: 62                                   │ │
│  │  • Vendedor Scarlet: 2 leads                              │ │
│  │  • Vendedor Yasmin: 3 leads                               │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Detalhes Tecnicos

### 1. Hook `useBulkLeadUpdate.ts`

```typescript
interface BulkUpdateRow {
  telefone: string;
  valorNegociado?: number;
  qtdCamisas?: number;
  vendedor?: string;
}

interface BulkUpdateOptions {
  updateLeadStatus: boolean;     // Atualizar para "07 - Pedido Fechado"
  updateNegotiatedValue: boolean;
  updateShirtQuantity: boolean;
  updateAssignee: boolean;       // Atualizar vendedor
}

interface BulkUpdateResult {
  total: number;
  updated: number;
  notFound: number;
  errors: number;
  summary: {
    totalValue: number;
    totalQuantity: number;
    byAgent: Record<string, number>;
  };
  log: UpdateLogEntry[];
}
```

### 2. Logica de Processamento

Para cada linha do PDF/planilha:

```text
1. Normalizar telefone (remover formatacao)
2. Buscar contato pelo telefone
3. Se encontrado:
   a. Atualizar negotiated_value
   b. Atualizar shirt_quantity
   c. Atualizar lead_status = "07 - Pedido Fechado"
   d. Mapear vendedor → assigned_to (fuzzy match)
   e. Atualizar conversations.assigned_to (sincronizacao)
4. Registrar no log
```

### 3. Atualizacao Sincronizada (Dual-Field)

Conforme regra de negocio existente, ao atualizar o vendedor:
- Atualiza `contacts.assigned_to` (Responsavel pelo contato)
- Atualiza `conversations.assigned_to` (Atendente atual da conversa)

```sql
-- Atualizar contato
UPDATE contacts
SET 
  negotiated_value = [valor],
  shirt_quantity = [qtd],
  lead_status = '07 - Pedido Fechado',
  assigned_to = [profile_id],
  updated_at = NOW()
WHERE phone = [telefone_normalizado];

-- Sincronizar conversa ativa
UPDATE conversations
SET 
  assigned_to = [profile_id],
  updated_at = NOW()
WHERE contact_id = [contact_id]
  AND status IN ('open', 'pending');
```

### 4. Parse de PDF

O sistema usara a ferramenta `document--parse_document` para extrair tabelas do PDF e converter em dados estruturados.

Para PDFs do Bling, o parser identificara automaticamente:
- Cabecalhos: "Cliente", "Celular", "Qtd", "Total Pedido", "Vendedor"
- Linhas de dados com valores

### 5. Mapeamento Automatico de Colunas

```typescript
const autoMapColumns = (headers: string[]) => {
  const mapping = {};
  
  headers.forEach(h => {
    const lower = h.toLowerCase().trim();
    
    // Telefone
    if (lower.includes('celular') || lower.includes('telefone') || lower.includes('fone')) {
      mapping.telefone = h;
    }
    
    // Quantidade
    if (lower === 'qtd' || lower.includes('quantidade')) {
      mapping.qtdCamisas = h;
    }
    
    // Valor
    if (lower.includes('total') || lower.includes('valor') || lower.includes('pedido')) {
      mapping.valorNegociado = h;
    }
    
    // Vendedor
    if (lower.includes('vendedor') || lower.includes('agente') || lower.includes('responsavel')) {
      mapping.vendedor = h;
    }
  });
  
  return mapping;
};
```

### 6. Invalidacao de Cache

Apos atualizacao, invalidar queries para refletir mudancas no frontend:

```typescript
queryClient.invalidateQueries({ queryKey: ['conversation-details'] });
queryClient.invalidateQueries({ queryKey: ['conversations-paginated'] });
queryClient.invalidateQueries({ queryKey: ['contacts-for-kanban'] });
queryClient.invalidateQueries({ queryKey: ['contacts'] });
```

---

## Navegacao e Acesso

### Rota

```typescript
// Em App.tsx
<Route path="/leads/atualizacao" element={
  <ProtectedRoute permission="deals.view">
    <BulkLeadUpdate />
  </ProtectedRoute>
} />
```

### Menu Lateral

Adicionar item "Atualizacao em Massa" dentro do grupo CRM ou como item separado com icone de upload.

---

## Beneficios

1. **Fluxo recorrente**: Pode ser usado sempre que exportar vendas do Bling
2. **Atualizacao completa**: Status + Valor + Quantidade + Vendedor em uma operacao
3. **Sincronizacao automatica**: Front e back atualizados simultaneamente
4. **Mapeamento inteligente**: Reconhece vendedores mesmo com variacoes de nome
5. **Suporte a PDF**: Processa diretamente o formato exportado do Bling
6. **Historico**: Registra todas as atualizacoes para auditoria

---

## Proximos Passos Apos Aprovacao

1. Criar pagina `BulkLeadUpdate.tsx` com interface de upload
2. Implementar hook `useBulkLeadUpdate.ts` com logica de processamento
3. Criar componentes de preview e resultado
4. Adicionar rota e item no menu
5. Testar com os 5 leads do PDF enviado
