
# Adicionar ordenacao clicavel na tabela "Criativo x Status do Lead"

## O que sera feito
Tornar os cabecalhos da tabela "Criativo x Status do Lead" (aba Data Cross) clicaveis para ordenar os dados de maior para menor e de menor para maior. Ao clicar no nome da coluna, alterna entre ordem decrescente, crescente e sem ordenacao.

## Como funciona
- Clicar uma vez: ordena do maior para o menor
- Clicar novamente: ordena do menor para o maior
- Clicar pela terceira vez: volta a ordenacao padrao (por Total decrescente)
- Setas visuais indicam a direcao ativa (mesmo padrao ja usado em outras tabelas do sistema)

## Detalhes tecnicos

### Arquivo: `src/pages/WhatsAppLeadTracking.tsx`

**1. Novo state de ordenacao** para a tabela Data Cross (separado do `sortConfig` existente que e usado na aba Leads):

```
dcSortConfig: { key: string; direction: 'asc' | 'desc' } | null
```

**2. Novo componente `DcSortableHeader`** (ou reutilizar o `SortableHeader` existente com o state correto) que usa `dcSortConfig` em vez de `sortConfig`.

**3. Aplicar ordenacao nas rows do `dcCrossData`**: Apos construir o array de rows (linha 467-472), aplicar a ordenacao baseada em `dcSortConfig`:
- key `'creative'`: ordena pelo nome do criativo (alfabetico)
- key `'total'`: ordena pelo total de leads
- key de qualquer status (ex: `'new'`, `'01 - Nao respondeu'`): ordena pela contagem daquele status
- key `'convRate'`: ordena pela taxa de avanco

**4. Substituir os `TableHead` fixos** (linhas 1350-1362) por `DcSortableHeader` clicaveis em todas as colunas: Criativo, Total, cada status dinamico e Avanco.
