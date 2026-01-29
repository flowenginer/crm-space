
# Plano de Melhorias: Importador de Contatos

## Problemas Identificados

Analisando o código em `src/components/settings/ContactImporter.tsx` e `src/hooks/useImportContacts.ts`, identifiquei três problemas principais:

### 1. Atribuição de Vendedor Não Funciona Corretamente
**Causa**: O sistema atual busca o vendedor pelo NOME na planilha usando `findProfileByName()` com busca parcial (`ilike`). Se o nome na planilha não corresponder exatamente ao nome cadastrado no sistema, a atribuição falha silenciosamente (apenas loga um warning).

**Problema adicional**: Não existe opção para selecionar um vendedor fixo para todos os contatos - apenas mapeia uma coluna da planilha.

### 2. Não há Seleção de Canal WhatsApp
**Causa**: O sistema atualiza apenas a tabela `contacts`, mas não vincula/cria conversas no canal específico. Não existe campo de seleção de canal na interface.

### 3. Upload Muito Lento
**Causa**: O processamento é sequencial - cada linha faz múltiplas queries ao banco:
- 1 query para buscar contato por telefone (até 3 variações)
- 1 query para criar contato (se não existir)
- N queries para processar etiquetas
- 1 query para buscar vendedor por nome
- 1 query para atualizar contato
- 1 query para atualizar conversas

Para 1000 contatos, isso pode significar mais de 5000 queries individuais.

---

## Solução Proposta

### 1. Adicionar Seletor de Vendedor Padrão

Adicionar um dropdown na UI que permite selecionar um vendedor fixo para atribuir a TODOS os contatos importados (independente da coluna mapeada).

**Novo fluxo**:
- Se selecionar vendedor no dropdown: atribui esse vendedor a todos
- Se mapear coluna de vendedor: busca pelo nome na planilha
- Ambas opções podem coexistir (dropdown tem prioridade)

**Arquivos a modificar**:
| Arquivo | Alteração |
|---------|-----------|
| `src/components/settings/ContactImporter.tsx` | Adicionar Select para escolher vendedor padrão |
| `src/hooks/useImportContacts.ts` | Aceitar `defaultAssigneeId` nas options e usar diretamente |

### 2. Adicionar Seletor de Canal WhatsApp

Adicionar dropdown para selecionar o canal WhatsApp onde os contatos devem ser associados. Isso criará/atualizará conversas no canal escolhido.

**Novo fluxo**:
- Se canal selecionado: para cada contato importado, cria ou atualiza conversa nesse canal
- Se não selecionado: comportamento atual (só atualiza contacts)

**Arquivos a modificar**:
| Arquivo | Alteração |
|---------|-----------|
| `src/components/settings/ContactImporter.tsx` | Adicionar Select para canal |
| `src/hooks/useImportContacts.ts` | Aceitar `channelId` nas options e criar/vincular conversas |

### 3. Otimizar Performance com Processamento em Lote

Implementar batch processing para reduzir drasticamente o número de queries:

**Estratégia de otimização**:

1. **Pré-carregar dados**: Antes de processar, buscar todos os contatos existentes, perfis e etiquetas em queries únicas
2. **Cache local**: Manter cache em memória de contatos, perfis e tags
3. **Batch inserts/updates**: Agrupar operações de INSERT e UPDATE (máximo 100 por batch)
4. **Processamento paralelo**: Processar múltiplas linhas simultaneamente (chunks de 10-20)

**Ganho esperado**: De ~5000 queries para ~50 queries (para 1000 contatos)

**Arquivos a modificar**:
| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useImportContacts.ts` | Refatorar para batch processing |

---

## Detalhes Técnicos

### Interface Atualizada (ContactImporter.tsx)

```text
+----------------------------------+
| Opções de Importação             |
+----------------------------------+
| Vendedor padrão: [Dropdown ▼]    |  <-- NOVO
| (Opcional - aplica a todos)      |
|                                  |
| Canal WhatsApp: [Dropdown ▼]     |  <-- NOVO
| (Opcional - cria conversas)      |
|                                  |
| [x] Criar contatos que não       |
|     existem                      |
| [x] Criar etiquetas que não      |
|     existem                      |
| [x] Atualizar status de lead     |
| [x] Atualizar vendedor atribuído |
|   [x] Apenas se não tiver        |
|       responsável                |
+----------------------------------+
```

### Estrutura de Options Atualizada

```typescript
interface ImportOptions {
  createMissingContacts: boolean;
  createMissingTags: boolean;
  updateLeadStatus: boolean;
  updateAssignee: boolean;
  onlyAssignIfEmpty: boolean;
  // NOVOS CAMPOS:
  defaultAssigneeId?: string;  // ID do vendedor padrão
  channelId?: string;          // ID do canal WhatsApp
}
```

### Fluxo de Processamento Otimizado

```text
1. PRE-LOADING (3 queries)
   ├── Buscar todos contacts por telefone (IN query)
   ├── Buscar todos profiles ativos
   └── Buscar todas tags existentes

2. PROCESSAMENTO EM MEMÓRIA
   ├── Normalizar telefones
   ├── Match com cache de contacts
   ├── Preparar batches de INSERT/UPDATE
   └── Resolver vendedor (por ID ou nome)

3. BATCH OPERATIONS
   ├── INSERT contacts (batch de 100)
   ├── UPDATE contacts (batch de 100)
   ├── INSERT contact_tags (batch de 100)
   └── UPSERT conversations (batch de 100)

4. PROGRESSO
   └── Atualizar UI a cada batch completado
```

---

## Estimativa de Arquivos

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `src/components/settings/ContactImporter.tsx` | Modificar | Adicionar selects de vendedor e canal + integrar com hooks existentes |
| `src/hooks/useImportContacts.ts` | Modificar | Refatorar para batch processing + novos campos de options |

## Resultado Esperado

1. **Atribuição funcional**: Vendedor pode ser selecionado diretamente no dropdown, garantindo atribuição correta
2. **Canal configurável**: Contatos importados podem ser vinculados a um canal específico
3. **Performance**: Importação de 1000 contatos deve cair de ~5 minutos para ~30 segundos
