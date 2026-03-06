

## Problema

A tabela visual do relatório de atendimentos tem colunas fixas no HTML (linhas 816-891) que não incluem "Origem", "Plataforma Anúncio" nem "URL Anúncio". Essas colunas só existiam na configuração de exportação Excel. A coluna "Origem" precisa voltar a aparecer na tabela visual.

## Solução

Adicionar a coluna **Origem** na tabela visual do relatório, entre "Contato" e "Canal".

### Alterações em `src/pages/ConversationReport.tsx`

**1. Header da tabela (linha ~822-823)** — Adicionar coluna "Origem" entre "Contato" e "Canal":
```html
<th>Contato</th>
<th>Origem</th>    <!-- NOVA -->
<th>Canal</th>
```

**2. Body da tabela (linha ~862-863)** — Adicionar célula com `formatOrigin(conv.contact?.origin)` entre "Contato" e "Canal":
```html
<td>{formatPhone(conv.contact?.phone)}</td>
<td>{formatOrigin(conv.contact?.origin)}</td>    <!-- NOVA -->
<td>{conv.channel?.name || '-'}</td>
```

**3. Ajustar `colSpan`** dos estados loading e empty (linhas ~836 e ~843) de `12` para `13`.

Nenhuma alteração nas funções RPC ou queries existentes.

