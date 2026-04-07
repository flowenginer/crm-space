

## Plano: Restaurar salvamento de mensagens Instagram + Corrigir erros de build

### Diagnóstico

**Por que a mensagem enviada não apareceu no frontend:**
O último deploy removeu acidentalmente o bloco de código em `instagram-send-message/index.ts` que salvava a mensagem enviada na tabela `messages`. Sem esse insert, a mensagem é enviada ao Instagram com sucesso, mas nunca aparece no CRM.

**Erros de build (whatsapp-webhook):**
4 erros de tipo causados por selects inconsistentes:
- Linha 1128: `let contact = null` — em um branch (linha 1223) o select é `"id"` apenas, mas no uso posterior (linha 1924) acessa `.full_name` e `.phone`
- Linha 2231/2251: selects retornam `{id, full_name, phone, department_id}` sem `lead_status`, mas o tipo exige `lead_status`

---

### Alterações

#### 1. Restaurar salvamento de mensagem no Instagram (`supabase/functions/instagram-send-message/index.ts`)

Após o bloco que atualiza `instagram_configs.updated_at` (linha 287-293), reinserir a lógica removida:
- Buscar contato pelo IGSID (`ig:{recipientId}`) na tabela `contacts`
- Se não tiver `conversationId`, buscar conversa aberta/pendente do contato
- Inserir registro na tabela `messages` com `is_from_me: true`
- Atualizar metadados da conversa (`last_message_at`, `last_message_preview`, etc.)

#### 2. Corrigir tipo do contact no fromMe (`supabase/functions/whatsapp-webhook/index.ts`)

- **Linha 1223**: Alterar select de `"id"` para `"id, phone, full_name"` para ficar consistente com o branch principal (linha 1138)
- **Linha 2217**: Alterar select para incluir `lead_status`: `"id, full_name, phone, department_id, lead_status"`
- **Linha 2226**: Alterar select para incluir `lead_status`: `"id, full_name, phone, department_id, lead_status"`

#### 3. Deploy das Edge Functions
- Redeployar `instagram-send-message` e `whatsapp-webhook`

---

### Arquivos alterados
- `supabase/functions/instagram-send-message/index.ts`
- `supabase/functions/whatsapp-webhook/index.ts`

