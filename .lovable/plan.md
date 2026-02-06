

# Correção: Distribuição de Departamento não preenche Atendente Atual

## Problema

Quando a distribuição automática do departamento roda (tanto via automação quanto via configuração do CRM), o "Atendente Responsável" (contacts.assigned_to) é preenchido corretamente, mas o "Atendente Atual" (conversations.assigned_to) fica como "Não atribuído".

A causa raiz é que o UPDATE na tabela `conversations` dentro da função `distribute-lead` falha silenciosamente com erro `P0001` (tenant_id obrigatório). A correção de adicionar `tenant_id` já está no código, mas precisa ser redeployada.

Além disso, existem erros de build no TypeScript que impedem o deploy: os hooks `useUserChannels.ts` e `useUserChannelsConfig.ts` referenciam a tabela `user_channels` que não existe no arquivo de tipos auto-gerado do Supabase.

## Correções

### 1. Corrigir erros de build (useUserChannels.ts e useUserChannelsConfig.ts)

Adicionar `// @ts-ignore` nos acessos à tabela `user_channels` ou usar type casting com `as any` para contornar o fato de que a tabela existe no banco mas não está no arquivo de tipos gerado automaticamente.

Arquivos afetados:
- `src/hooks/useUserChannels.ts` - cast `.from('user_channels' as any)` na linha 33
- `src/hooks/useUserChannelsConfig.ts` - cast `.from('user_channels' as any)` nas linhas 29, 64, 90, 120, 147, 165

### 2. Redeploy das Edge Functions

Redeployar `distribute-lead` e `execute-flow-node` para garantir que as correções de `tenant_id` estejam ativas em produção.

## Resultado Esperado

Após as correções:
- Build passa sem erros de TypeScript
- Edge functions são redeployadas com o fix de `tenant_id`
- A distribuição automática preenche TANTO o "Atendente Atual" quanto o "Atendente Responsável"
- Funciona para TODOS os tenants (o `tenant_id` é extraído do contato, não hardcoded)
- Funciona para tenants futuros (mesma lógica)

