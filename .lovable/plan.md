
## Diagnóstico Completo

Após analisar o banco de dados com dados reais, identifiquei a causa raiz:

**A coluna "URL Anúncio" está vazia porque a função RPC foi recriada mas o Supabase ainda está executando a versão em cache**, ou porque o campo correto para leads do tipo `redirect` não é uma URL — é o nome do criativo (utm_content).

### Estrutura real dos dados no banco

| Tipo de lead | Campo disponível | Valor real |
|---|---|---|
| `ctwa_ad` (CTWA direto) | `video_url` | URL do reel (ex: `https://www.facebook.com/reel/913176884570657/`) |
| `ctwa_ad` (CTWA direto) | `source_url` | URL do post Instagram (ex: `https://www.instagram.com/p/DT94h2jAMYb/`) |
| `redirect` (UTM/link) | `utm_content` | Nome do criativo (ex: `"SS02.4-1 CT_VIDEO - AGRO"`) |
| `redirect` (UTM/link) | `utm_medium` | Nome do conjunto (ex: `"SS02.4 | AGRO | SEGMENTADO"`) |
| `meta_ads` (detectado) | nenhum | vazio |

A lógica `COALESCE` atual **funciona corretamente no banco** quando testada diretamente. O problema é que o **DROP FUNCTION** nas migrations anteriores pode não ter eliminado todas as assinaturas sobrepostas, e o PostgREST pode estar usando uma versão desatualizada da função.

### Solução

1. **Nova migration definitiva** que:
   - Dropa **todas** as variações de assinatura existentes da função (para garantir limpeza total)
   - Recria a função com a lógica `COALESCE` correta para `referral_source_url`:
     - Prioridade 1: `video_url` (CTWA — URL do vídeo/reel no Facebook)
     - Prioridade 2: `source_url` (CTWA — URL do post no Instagram)
     - Prioridade 3: `utm_content` (redirect/UTM — nome do criativo)
     - Prioridade 4: `utm_medium` (redirect/UTM — nome do conjunto de anúncios)
   - Re-concede permissões
   - Força reload do schema

2. **Separar em 2 colunas no relatório** (melhoria): 
   - `referral_source_url` → URL real (apenas para CTWA)
   - Renomear para algo que faça mais sentido — para leads `redirect`, mostrar o nome do criativo na coluna "Criativo" e a URL real na coluna "URL Anúncio"

### Arquivos afetados

- **1 nova migration SQL** — corrigir e garantir que a função está ativa com a lógica certa

### Resultado esperado

- Leads `ctwa_ad`: coluna "URL Anúncio" mostra `https://www.facebook.com/reel/...` ou `https://www.instagram.com/p/...`
- Leads `redirect`: coluna mostra o nome do criativo (ex: `"SS02.4-1 CT_VIDEO - AGRO"`) — pois não há URL disponível nesse tipo de rastreamento
- Leads `meta_ads` (detectados por padrão): coluna vazia (sem dados de rastreamento)

Isso é o máximo que os dados permitem — leads do tipo `redirect` rastreados via UTM simplesmente não possuem uma URL de anúncio armazenada, apenas o nome do criativo.
