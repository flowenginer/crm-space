

## Plano: Corrigir scopes OAuth e configurar webhook do Instagram

### Problema
Os scopes OAuth no código usam nomes antigos que a Meta não reconhece mais. Além disso, o webhook do Instagram não está configurado.

### 1. Corrigir scopes na Edge Function `instagram-oauth`

**Arquivo:** `supabase/functions/instagram-oauth/index.ts` (linha 64)

Trocar:
```
instagram_basic,instagram_manage_messages,pages_messaging,pages_show_list
```
Por:
```
instagram_business_basic,instagram_business_manage_messages
```

Esses são os scopes corretos da nova API do Instagram (Instagram API with Instagram Login), conforme mostrado no painel da Meta.

### 2. Configurar webhook do Instagram no Meta Portal (manual pelo usuário)

Preencher no Step 3 do painel:
- **URL de callback:** `https://<SUPABASE_PROJECT_REF>.supabase.co/functions/v1/instagram-webhook`
- **Verificar token:** O valor gerado e salvo em `instagram_configs.verify_token` (será criado quando salvar a conta)

> Nota: Precisamos verificar a edge function `instagram-webhook` para confirmar que ela suporta verificação GET do Meta.

### 3. Verificar edge function `instagram-webhook` suporta verificação

Ler o arquivo para confirmar que trata o GET de verificação do Meta (hub.mode=subscribe, hub.verify_token, hub.challenge).

### Arquivos modificados
| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/instagram-oauth/index.ts` | Corrigir scopes para `instagram_business_basic,instagram_business_manage_messages` |

### O que o usuário precisa fazer manualmente no Meta Portal
1. **Step 1** — ✅ Já está concluído
2. **Step 2** — Clicar "Gerar token" para spacesports.oficial (pode deixar para depois, não bloqueia o OAuth)
3. **Step 3** — Preencher URL de callback e verificar token (após conectar a conta via OAuth)
4. **Step 4** — Clicar "Configurar" para configurar o login da empresa
5. **Step 5** — Submeter para análise (necessário apenas para produção com usuários externos)

