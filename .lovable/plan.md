
## Plano: Conectar Instagram Direct via Login Facebook (OAuth)

### Conceito
Reaproveitar o mesmo fluxo OAuth do Meta Ads (`meta-oauth`) para Instagram Direct. O usuário clica em "Conectar Instagram" na página de Canais, faz login com Facebook, e o sistema automaticamente identifica as Pages e Instagram Business Accounts vinculadas, cria o canal e salva as credenciais — sem precisar digitar IDs manualmente.

### O que será feito

**1. Nova Edge Function `instagram-oauth`**
- Action `get-login-url`: Gera URL OAuth do Facebook com scopes `instagram_basic,instagram_manage_messages,pages_messaging,pages_show_list`
- Action `exchange-code`: Troca code por token, busca `/me/accounts` (Pages), para cada Page busca o `instagram_business_account`, retorna lista de Pages+IG accounts para o usuário escolher
- Action `save-account`: Salva Page Access Token (long-lived), cria/atualiza `instagram_configs` e cria canal tipo `instagram` em `whatsapp_channels`

**2. Componente `InstagramConnect` (modal popup)**
- Similar ao `MetaConnect.tsx` / `CloudAPIConnect`
- Botão "Conectar com Facebook" abre popup OAuth
- Após retorno, exibe lista de Pages/IG accounts para seleção
- Salva e cria canal automaticamente

**3. Integração na página de Canais (`WhatsAppChannels.tsx`)**
- Adicionar opção "Instagram Direct" no dropdown "Adicionar Canal"
- Exibir canais Instagram em uma seção separada (como já existe para oficiais/não-oficiais)
- Card específico para canais Instagram com ícone do Instagram

**4. Callback page**
- Reutilizar ou criar `/instagram-oauth-callback` para capturar o code e enviar de volta ao CRM via `postMessage`/`localStorage`

### Detalhes técnicos

- O token do usuário é trocado por Page Access Token (nunca expira se long-lived page token)
- A Graph API v21.0 endpoint `/me/accounts?fields=id,name,access_token,instagram_business_account` retorna Pages e IG IDs
- Para cada Page com `instagram_business_account`, busca `/{ig_id}?fields=id,username,profile_picture_url,name`
- O `page_access_token` long-lived é obtido via `/oauth/access_token?grant_type=fb_exchange_token` e depois `/{page_id}?fields=access_token` (page tokens de long-lived user tokens nunca expiram)

### Arquivos a criar/modificar

| Arquivo | Ação |
|---------|------|
| `supabase/functions/instagram-oauth/index.ts` | Criar — Edge Function OAuth para Instagram |
| `src/components/instagram/InstagramConnect.tsx` | Criar — Modal de conexão via Facebook Login |
| `src/pages/InstagramOAuthCallback.tsx` | Criar — Página callback para popup |
| `src/pages/WhatsAppChannels.tsx` | Modificar — Adicionar botão Instagram e seção de canais IG |
| `src/App.tsx` | Modificar — Adicionar rota `/instagram-oauth-callback` |

### Permissões Meta necessárias (já configuradas no app 1540198137306576)
- `instagram_basic`
- `instagram_manage_messages`
- `pages_messaging`
- `pages_show_list`
