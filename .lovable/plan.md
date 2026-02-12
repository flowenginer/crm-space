
# Corrigir exibicao de conversoes no WhatsApp Lead Tracking

## Problema
O dashboard filtra conversas por `created_at` dentro do range de datas selecionado. Porem, as conversoes sao registradas no contato (`custom_fields.conversoes`) com suas proprias datas, independente da data da conversa. Quando a conversa do lead foi criada fora do range de datas (ex: semanas atras), mas a conversao foi registrada hoje, o lead nao aparece no dashboard.

## Solucao
Adicionar uma query complementar que busca **contatos com conversoes dentro do periodo selecionado**, independentemente da data da conversa. Esses contatos serao mesclados com os leads ja encontrados, garantindo que toda conversao no periodo apareca na aba de Conversoes e nos Top 5.

## Detalhes tecnicos

### Arquivo: `src/hooks/useWhatsAppLeadTracking.ts`

**1. Nova query de contatos com conversoes recentes** (apos as queries existentes, ~linha 370):

Buscar contatos que possuem `custom_fields.conversoes` nao vazio, cujos IDs ainda nao estao nos leads ja processados. A filtragem por data da conversao sera feita no JS (ja que `conversoes` e um array JSONB).

```text
Query: contacts com custom_fields != null
  -> Filtrar no JS: conversoes[] onde data esta dentro do dateFrom/dateTo
  -> Excluir contatos ja presentes nos leads processados
  -> Para cada: buscar suas conversations para extrair tracking data
  -> Adicionar ao array de leads com has_conversion = true
```

**2. Para cada contato com conversao encontrado**:
- Buscar todas as conversas desse contato (sem filtro de data) para encontrar dados de rastreamento (referral_source, referral_data)
- Aplicar a mesma logica de priorizar a conversa com tracking
- Construir o TrackedLead com `has_conversion: true` e `conversion_total` calculado apenas das conversoes dentro do periodo

**3. Mesclar com os leads existentes**:
- Se o contato ja existe nos leads (porque sua conversa caiu no range), nao duplicar
- Se nao existe, adicionar como novo lead

**4. Recalcular conversion_total baseado no periodo**:
- Atualmente, `conversion_total` soma TODAS as conversoes do contato independente de data
- Ajustar para que, na aba Conversoes, o total reflita apenas as conversoes dentro do periodo selecionado (filtrando pelo campo de data dentro de cada objeto em `custom_fields.conversoes`)

### Impacto
- Leads com conversoes recentes mas conversas antigas agora aparecerao na aba Conversoes e no Top 5
- O calculo de faturamento sera mais preciso (baseado no periodo selecionado)
- Nenhuma mudanca visual, apenas dados mais completos
