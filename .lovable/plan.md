

## Diagnóstico do Problema

Identifiquei a causa raiz: **o CRM tem 21.020 contatos, mas a Edge Function só buscou 6.000** (limite do Supabase). Os outros 15.020 contatos foram ignorados, resultando em 201/214 pedidos como "não encontrado".

O contato "JAILSON GUERRA" com telefone `5566996791974` (suffix `96791974`) **está no CRM** e deveria ter dado match com o CSV `(66) 99679-1974` — mas ele caiu fora dos 6.000 buscados.

## Solução

Mudar a estratégia de matching: em vez de buscar todos os contatos na memória (impossível com 21k+), fazer a busca diretamente no banco de dados para cada telefone do CSV.

### Edge Function `cross-reference-sales/index.ts`

1. **Extrair todos os telefones únicos do CSV** (214 pedidos)
2. **Buscar no banco por SQL** usando `RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 8)` para cada batch de telefones — consulta direta que ignora o limite de 1000 rows porque busca só os que precisamos
3. **Buscar também com 9 dígitos** (suffix de 9) para cobrir variações com/sem o 9º dígito brasileiro
4. **Para cada contato encontrado**, buscar conversas, primeira mensagem e meta_ads (como já faz)
5. Manter toda a lógica de categorização de origem e conversão

A query principal será algo como:
```sql
SELECT id, full_name, phone, origin, referral_data, origin_campaign, lead_status, custom_fields
FROM contacts
WHERE tenant_id = $tenantId
AND RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 8) = ANY($suffixes)
```

Isso busca exatamente os contatos que precisamos, sem limite de rows.

### Build Error Fix

Corrigir o erro de TypeScript em `LeadConversionDashboard.tsx` linha 530 — remover a propriedade `angle` do `tick` do XAxis que não é aceita pelo tipo do Recharts.

### Arquivos alterados
- `supabase/functions/cross-reference-sales/index.ts` — reescrever matching para usar query SQL direta
- `src/pages/LeadConversionDashboard.tsx` — fix do build error (linha 530)

