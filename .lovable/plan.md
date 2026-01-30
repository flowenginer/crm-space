

# Melhoria na Exibição de Respostas Interativas

## Problema Atual

As mensagens de resposta interativa (como permissão de chamada) são exibidas como "[Interativo]" em vez de mostrar o que o cliente realmente selecionou.

## Solução em 2 Partes

### Parte 1: Corrigir Mensagens Existentes no Banco

As mensagens antigas foram salvas com `[Interativo]` porque a correção foi feita depois. Vou criar uma migração para atualizar o conteúdo dessas mensagens específicas.

| Arquivo | Ação |
|---------|------|
| `supabase/migrations/fix_interactive_messages.sql` | Criar migração para atualizar conteúdo |

**SQL da Migração:**
```sql
-- Atualiza mensagens de permissão de chamada que foram salvas incorretamente
UPDATE messages 
SET content = '✅ Permissão de chamada concedida',
    updated_at = now()
WHERE message_type = 'interactive' 
AND content = '[Interativo]'
AND conversation_id IN (
  SELECT id FROM conversations 
  WHERE contact_id IN (
    SELECT id FROM contacts 
    WHERE call_permission_status = 'granted'
  )
);
```

### Parte 2: Melhorar Renderização no Frontend

Atualizar o componente de chat para exibir mensagens interativas de forma mais amigável, com ícones e formatação adequada.

| Arquivo | Modificação |
|---------|-------------|
| `src/pages/Conversations.tsx` | Adicionar tratamento visual para `interactive` |

**Mudança no Código:**
Em vez de renderizar apenas texto genérico, adicionar tratamento especial para mensagens interativas:

```tsx
{/* Interactive messages with better display */}
{message.message_type === 'interactive' && message.content && (
  <div className="flex items-center gap-2 text-sm">
    {message.content.includes('✅') ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : message.content.includes('❌') ? (
      <XCircle className="h-4 w-4 text-red-500" />
    ) : (
      <MessageSquare className="h-4 w-4 text-muted-foreground" />
    )}
    <span className="leading-relaxed">{message.content}</span>
  </div>
)}
```

## Fluxo Visual Após Correção

```text
ANTES:                           DEPOIS:
┌─────────────────────┐         ┌─────────────────────────────────┐
│ [Interativo]        │   →     │ ✅ Permissão de chamada         │
│ 14:35               │         │    concedida                    │
└─────────────────────┘         │ 14:35                           │
                                └─────────────────────────────────┘
```

## Benefícios

1. **Clareza**: Cliente e atendente sabem exatamente o que foi respondido
2. **Histórico**: Mensagens antigas serão corrigidas retroativamente
3. **Consistência**: Novas respostas já serão salvas com o texto correto (webhook já corrigido)

## Resposta sobre Cobrança

| Cenário | Cobrança Meta |
|---------|---------------|
| Dentro da janela de 24h | ❌ Não cobra |
| Fora da janela de 24h | ✅ Cobra como conversa iniciada pela empresa |

O pedido de permissão de chamada enviado **dentro da janela de 24 horas** (enquanto há uma conversa ativa com o cliente) **não é cobrado** pela Meta. É considerado parte da conversa de serviço já em andamento.

