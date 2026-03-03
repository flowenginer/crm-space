

## Plano: PROCV da planilha de vendas com o CRM

### Contexto
A planilha CSV contém ~289 pedidos únicos (13688 a 13976) de fevereiro/2026 com 9733 linhas (campos multilinha nas observações). Preciso cruzar o "Celular Comprador" com os contatos do CRM para identificar a origem real de cada comprador.

### Desafio técnico
O CSV tem campos com quebra de linha (coluna "Observações"), tornando a leitura linha-a-linha impossível. Preciso de um parser robusto que trate campos entre aspas com line breaks.

### Solução: Edge Function de cruzamento

Criar uma Edge Function `cross-reference-sales` que:

1. **Recebe o CSV** como texto no body da requisição
2. **Parseia** com tratamento de campos multilinha (respeita aspas duplas como delimitadores)
3. **Extrai telefones únicos** da coluna "Celular Comprador" (índice 12)
4. **Normaliza** cada telefone removendo caracteres especiais e pegando os últimos 8 dígitos
5. **Consulta o CRM** buscando contatos cujo `RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 8)` bata com cada telefone
6. **Para cada match**, busca:
   - `origin` do contato
   - `referral_source` da conversa
   - Primeira mensagem (para detectar "Linktree", "Site", etc.)
   - Nome do criativo (cruzando `meta_ads`)
7. **Retorna** o relatório completo:
   - Nome do comprador, telefone, valor do pedido
   - Match no CRM (sim/não), nome no CRM
   - Origem categorizada (Linktree / CTWA Ads / Meta Ads Direto / Redirect / WhatsApp Orgânico / Manual / Sem origem)
   - Nome do criativo (quando aplicável)
   - Resumo agregado por origem

### Front-end
Criar uma página/componente simples de upload que:
- Aceita o CSV
- Chama a Edge Function
- Exibe os resultados em tabela com totais por origem
- Separa claramente **Redirect** vs **Meta Ads Direto**

### Resultado esperado
O mesmo relatório de fevereiro que já foi entregue, mas agora baseado nos **compradores reais** da planilha do ERP (não nos status do CRM), com a origem correta de cada um e nenhum dado perdido.

### Arquivos envolvidos
- `supabase/functions/cross-reference-sales/index.ts` (novo)
- `src/pages/SalesAnalysis.tsx` (novo - página de análise)
- `src/components/sales/SalesReport.tsx` (novo - componente de relatório)
- Rota no App.tsx

