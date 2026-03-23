

## Plano: Correções da Integração Instagram Direct

### Resumo dos Problemas
1. **Nome do contato mostra ID** em vez do nome real
2. **Badge "API Oficial"** aparece em contatos do Instagram (deveria ser badge Instagram com cor roxa)
3. **Mensagens enviadas não chegam** ao lead no Instagram
4. **Leads do Instagram devem ir para Sala de Espera IA** (mesmo processo da API Oficial)
5. **Janela de 24h não se aplica** ao Instagram e deve ser escondida

### Causa Raiz Principal
O canal Instagram é criado com `type: 'official'` no `instagram-oauth/index.ts` (linha 248). Isso causa:
- Mensagens enviadas vão para `cloudapi-send-message` em vez de `instagram-send-message` (por isso não chegam)
- Badge "API Oficial" aparece no card
- Janela 24h é exibida (pois `isOfficialChannel = type === 'official'`)

---

### Alterações

#### 1. Edge Function `instagram-oauth` - Tipo de canal correto
**Arquivo:** `supabase/functions/instagram-oauth/index.ts`
- Alterar `type: 'official'` para `type: 'instagram'` na criação do canal (linha 248)
- Migrar canal existente: na atualização do canal existente, também setar `type: 'instagram'`

#### 2. Migração SQL - Corrigir canais Instagram existentes
- Criar migração para atualizar canais já criados com tipo errado:
```sql
UPDATE whatsapp_channels 
SET type = 'instagram' 
WHERE id IN (SELECT channel_id FROM instagram_configs WHERE is_active = true);
```

#### 3. Frontend `Conversations.tsx` - Badge Instagram
**Arquivo:** `src/pages/Conversations.tsx`
- No bloco de badges do card (linhas 606-654), adicionar detecção `isInstagram` via `channelData?.type === 'instagram'`
- Mostrar badge Instagram com cor roxa/gradiente (#E1306C ou #833AB4) em vez de "API Oficial"
- Usar ícone do Instagram e texto "Instagram"

#### 4. Frontend `Conversations.tsx` - Nome do contato
**Arquivo:** `src/pages/Conversations.tsx` (linha 458)
- Já usa `conversation.contact?.full_name || 'Contato'` - o nome virá correto se o webhook salvar corretamente

#### 5. Edge Function `instagram-webhook` - Melhorar busca de nome
**Arquivo:** `supabase/functions/instagram-webhook/index.ts`
- A busca de perfil (linha 260) usa `fields=name,profile_pic` mas a Instagram Login API pode não retornar `name` para todos os usuários
- Adicionar campo `username` como fallback: `fields=name,username,profile_pic`
- Atualizar `full_name` do contato existente quando obtiver nome real (contato pode ter sido criado com ID apenas)

#### 6. Frontend `ConversationSidebar.tsx` - Esconder janela 24h para Instagram
**Arquivo:** `src/components/conversations/ConversationSidebar.tsx`
- Na linha 180, adicionar `const isInstagramChannel = channel?.type === 'instagram'`
- Na linha 2019, alterar condição para `{windowStatus && isOfficialChannel && !isInstagramChannel && (`
- Com `type: 'instagram'`, `isOfficialChannel` já será `false`, então isso resolve automaticamente

#### 7. Edge Function `instagram-webhook` - Departamento Sala de Espera IA
O webhook já usa `channelDepartmentId` do canal (linhas 247-255). A solução é configurar o canal Instagram com o departamento "Sala de Espera IA" via UI de configuração de canais (campo "Departamento de entrada").

---

### Arquivos Modificados
1. `supabase/functions/instagram-oauth/index.ts` - tipo `instagram`
2. `supabase/functions/instagram-webhook/index.ts` - melhorar busca de nome
3. `src/pages/Conversations.tsx` - badge Instagram
4. Nova migração SQL - corrigir canais existentes

### Nota sobre Fragmentação
Nenhuma Edge Function nova será criada. As alterações são cirúrgicas nos arquivos existentes.

