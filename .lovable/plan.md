

# Adicionar todas as origens na aba de Conversoes

## O que sera feito
Atualmente a aba "Conversoes" mostra apenas leads que possuem `creative_name` (anuncios). Leads que converteram via **Linktree**, **WhatsApp organico** ou **Manual** sao ignorados porque nao tem criativo associado.

A mudanca vai incluir essas origens na mesma tabela, agrupando por nome do criativo quando disponivel, ou pelo nome da origem (ex: "Linktree", "WhatsApp Organico", "Manual") quando nao ha criativo.

## Resultado esperado
- A tabela de Conversoes passa a mostrar **todas** as conversoes, nao apenas as de anuncios
- Leads sem criativo aparecem agrupados pela origem: "Linktree", "WhatsApp Organico", "Manual", "Redirect"
- Os KPI cards (Total, Faturamento, Ticket Medio, Fontes unicas) refletem o total real
- O ranking continua funcionando normalmente

## Detalhes tecnicos

### Arquivo: `src/pages/WhatsAppLeadTracking.tsx`

**1. Alterar o `allConversionCreatives` (linha 339-386)**:
- Remover o filtro `!l.creative_name` (linha 342) que exclui leads sem criativo
- Para leads sem `creative_name`, usar o `source_type` como chave de agrupamento, mapeando para nomes legiveis:
  - `linktree` -> "Linktree"
  - `whatsapp` -> "WhatsApp Organico"
  - `manual` -> "Manual"
  - `redirect` -> "Redirect"
  - `ctwa` -> "CTWA (sem criativo)"
- A coluna "Criativo" passa a mostrar o nome do criativo ou o nome da origem
- As colunas "Conjunto" e "Campanha" ficam vazias para leads sem criativo

**2. Atualizar o `convTotals` (linha 388-395)**:
- Remover o filtro `&& l.creative_name` para incluir todos os leads com conversao nos totais
- Renomear "Criativos com Conversao" para "Fontes com Conversao" no KPI card

**3. Na tabela (coluna "Criativo")**:
- Adicionar um indicador visual (badge ou icone) para diferenciar origens de criativos
- Ex: leads de Linktree mostram um badge "Linktree" ao lado do nome

Nenhuma alteracao no hook -- todos os dados necessarios (`has_conversion`, `conversion_total`, `source_type`) ja existem no `TrackedLead`.
