
# Adicionar campos `sourceApp` e `sourceUrl` ao Relatório de Atendimentos

## O que sera feito

Adicionar duas novas colunas na exportacao Excel do relatorio de atendimentos:
- **Plataforma de Origem** (`sourceApp`) - ex: "facebook", "instagram"
- **URL de Origem** (`sourceUrl`) - ex: "https://fb.me/41pJjO5Zp"

Para conversas sem dados de referral (leads organicos, manuais, etc), as colunas virao em branco.

## Alteracoes

### 1. Alterar a funcao SQL `search_conversations_report`

Adicionar o campo `referral_data` (tipo jsonb) ao retorno da RPC, vindo diretamente de `conversations.referral_data`.

| Campo adicionado ao RETURNS TABLE | Tipo | Origem |
|---|---|---|
| `referral_source_app` | text | `c.referral_data->>'sourceApp'` |
| `referral_source_url` | text | `c.referral_data->>'sourceUrl'` |

### 2. Alterar `ConversationReport.tsx` - mapeamento dos dados

Na funcao que processa os resultados da RPC (linha ~205), adicionar os novos campos ao objeto retornado.

### 3. Alterar `ConversationReport.tsx` - exportacao Excel

Na funcao `handleExportExcel` (linha ~369), adicionar as duas novas colunas no mapeamento do Excel, posicionadas logo apos a coluna "Origem":

```
'Plataforma Anuncio': conv.referral_source_app || '',
'URL Anuncio': conv.referral_source_url || '',
```

## Resultado

O Excel exportado tera as colunas:
`# | Nome | Contato | Origem | Plataforma Anuncio | URL Anuncio | Status do Lead | ...`

Leads vindos do Meta Ads terao os campos preenchidos. Os demais terao as colunas em branco.
