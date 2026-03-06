

## Investigação: Conflito de Status entre Dois Canais (MASTER-LEADS e EMPREGA-MAIS)

### O que foi encontrado

**Dados reais do banco**: Existem ~20 contatos no tenant Master que possuem conversas em AMBOS os canais. Em todos os casos analisados, o `contact.lead_status` e o `conversation.lead_status` estão **consistentes** entre si — não há evidência de regressão causada por dois canais.

**Os 8 contatos reportados** (kel, WhatsApp 4839, Daiene, Nicolas, etc.) possuem conversas apenas no canal MASTER-LEADS — nenhum deles tem conversa no EMPREGA-MAIS. Portanto, o cenário de dois canais **não é a causa** do problema relatado anteriormente.

### Como o webhook funciona com dois canais

O webhook já possui uma lógica de **migração de canal** (linhas 2206-2254 do `whatsapp-webhook/index.ts`):

1. Se o contato manda mensagem pelo canal B e já tem conversa **aberta** no canal A → a conversa é **migrada** para o canal B (preserva atendente, departamento e lead_status)
2. Se não tem conversa aberta em nenhum canal, busca conversa **fechada** no mesmo canal → reabre
3. Se não encontra nada → cria conversa **nova** com `lead_status = 'new'` (default do banco)

### Risco identificado (cenário raro)

Há um cenário onde **pode** haver conflito:

1. Contato tem conversa **fechada** no canal MASTER-LEADS (lead_status = "Abordagem")
2. Contato manda mensagem pelo EMPREGA-MAIS
3. Webhook busca conversa fechada APENAS no EMPREGA-MAIS (`.eq("channel_id", channel.id)`) → **não encontra**
4. Cria conversa **nova** com `lead_status = 'new'` (default da tabela conversations)
5. **Porém**: o `contact.lead_status` NÃO é alterado (continua "Abordagem")

A sidebar lê `contact.lead_status` (fonte de verdade), então **o status mostrado ao atendente não muda**. Mas a conversa nova terá `conversation.lead_status = 'new'` internamente, o que pode causar inconsistência em relatórios.

### Conclusão

**O cenário de dois canais NÃO causa a regressão do status do lead para "new" na UI** — a sidebar sempre lê do `contact.lead_status`. A causa real do problema anterior (status não persistindo) já foi corrigida na alteração atômica do `ConversationSidebar.tsx`.

### Melhoria preventiva recomendada

Para eliminar qualquer inconsistência residual, a nova conversa criada pelo webhook deveria herdar o `lead_status` atual do contato. Isso envolve:

**Alteração no `whatsapp-webhook/index.ts`** (~linha 2468):
- Antes de criar uma nova conversa, buscar o `lead_status` atual do contato
- Incluir `lead_status: contact.lead_status || 'new'` no INSERT da conversa
- Isso garante que mesmo em cenários cross-channel, a conversa nova nasce com o status correto

Também corrigir a busca de conversa fechada (~linha 2268):
- Quando não encontra conversa fechada no mesmo canal, buscar em **qualquer canal** (similar ao que já faz com conversas abertas)
- Isso evita criar conversas duplicadas quando o contato manda mensagem por um canal diferente

