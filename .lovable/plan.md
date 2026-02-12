

# Buscar rastreamento de criativo em TODAS as conversas do lead

## Problema identificado
A logica atual de deduplicacao (linha 187-196 do hook) mantem apenas a **conversa mais recente** por contato. Quando o lead tem duas conversas — uma antiga com dados de rastreamento (referral_source, referral_data, criativo) e uma nova na API Oficial sem esses dados — o rastreamento se perde completamente.

Isso afeta diretamente o "Top 5 Criativos por Conversao" porque o lead pode ter conversao registrada (via custom_fields.conversoes no contato), mas sem criativo associado (porque veio da conversa errada).

## Solucao

### Alterar a logica de deduplicacao em `useWhatsAppLeadTracking.ts`

Em vez de manter apenas a conversa mais recente, a nova logica vai:

1. **Agrupar todas as conversas por contato** (em vez de manter so a mais recente)
2. **Priorizar a conversa que tem referral_data/referral_source** para extrair dados de rastreamento (criativo, campanha, adset)
3. **Usar a conversa mais recente** para dados operacionais (status, atendente, departamento)
4. **Combinar ambas** no TrackedLead final

### Logica proposta

```text
Para cada contato com multiplas conversas:
  - conversaRastreada = a que tem referral_source != null (dados de criativo)
  - conversaRecente = a mais recente (dados operacionais)
  - Lead final = dados de criativo da conversaRastreada + status/atendente da conversaRecente
```

### Arquivo: `src/hooks/useWhatsAppLeadTracking.ts`

**Substituir o bloco de deduplicacao (linhas 187-196)** por uma logica que agrupa todas as conversas por contactId em um Map de arrays, e depois no processamento (linha 203+), para cada contato:
- Encontrar a conversa com `referral_source` preenchido (para dados de rastreamento)
- Encontrar a conversa mais recente (para lead_status, assigned_to)
- Usar os dados combinados para construir o TrackedLead

**Impacto**: Nenhum outro arquivo precisa mudar. A interface TrackedLead ja tem todos os campos necessarios. O grafico de Top 5 e o bar chart vao automaticamente mostrar os criativos corretos porque o `creative_name` vai ser preenchido a partir da conversa que realmente tem o rastreamento.

## Resultado esperado
- Leads com conversao que antes apareciam sem criativo agora vao ter o criativo correto associado
- O "Top 5 Criativos por Conversao" vai refletir dados mais precisos
- Nenhuma mudanca visual — apenas dados mais completos e corretos
