
# Tornar Canal API_Oficial Visivel no Filtro para Todos

## Contexto

O canal "API_Oficial" recebe todos os novos leads e os direciona para "Sala de espera IA". Todos os usuarios precisam ver esse canal no filtro, porem cada usuario so visualiza as conversas dos seus proprios departamentos e atribuicoes. A visibilidade das conversas ja e controlada por logica separada (RLS + filtros de departamento) -- esta mudanca afeta **apenas o filtro de canais**.

## Alteracoes

### 1. Migracao SQL
- Adicionar coluna `visible_to_all BOOLEAN DEFAULT false` na tabela `whatsapp_channels`
- Marcar o canal API_Oficial com `visible_to_all = true`

### 2. `src/hooks/useChannels.ts`
- Adicionar `visible_to_all` na interface `WhatsAppChannel`
- Adicionar `visible_to_all` no SELECT da query

### 3. `src/hooks/useUserChannels.ts`
- No filtro por `userChannelIds`: incluir tambem canais com `visible_to_all === true`
- No filtro por departamento (fallback): adicionar `channel.visible_to_all` como condicao alternativa

## Resultado

- Todos os usuarios veem "API Oficial" no filtro de canais
- Cada usuario continua vendo apenas as conversas do seu departamento e atribuicao (logica existente, sem alteracao)
- O canal permanece vinculado ao departamento "Sala de espera IA" para roteamento de novos leads

## Complexidade

Baixa -- 1 coluna, 1 UPDATE, ajuste em 2 filtros no frontend.
