
# Correção do Bloco "Definir Variável" nas Automações

## Problema Identificado

O bloco **"Definir Variável" (set_variable)** está configurável no painel de propriedades do Flow Builder (frontend), mas **não possui implementação no backend**. A Edge Function `execute-flow-node` não tem o `case 'set_variable'` no switch de ações, ou seja, quando o fluxo chega nesse bloco, ele simplesmente **não faz nada** e segue adiante.

Isso explica por que os leads caem na automação do Linktree mas a origem nunca é atualizada.

## Impacto

- **574 contatos** enviaram mensagem contendo "Linktree" e **não** possuem `origin = 'linktree'`.
- Esses contatos aparecem sem origem ou com origem incorreta (ex: `meta_ads`, `whatsapp`, `ctwa_ad`).

## Plano de Correção

### Parte 1: Implementar o handler `set_variable` na Edge Function

Adicionar o `case 'set_variable'` no switch de ações da função `execute-flow-node/index.ts` (antes da linha 1059 onde fecha o switch). A lógica será:

1. Ler `config.variable` (o campo a atualizar, ex: `origin`, `full_name`, `email`)
2. Ler `config.value` (o valor a definir) e processar variáveis dinâmicas com `replaceVariables()`
3. Mapear o campo para a tabela correta:
   - Campos do contato (`origin`, `full_name`, `email`, `lead_status`, `notes`, `city`, `state`, `neighborhood`, `street`, `number`, `complement`, `zip_code`, `country`, `cpf_cnpj`, `person_type`, `contact_type`, `negotiated_value`, `origin_campaign`): atualizar na tabela `contacts`
   - Para `lead_status`: reutilizar a mesma lógica do `set_lead_status` (atualizar contato + conversas)
4. Incluir `tenant_id` no payload do `.update()` (requisito dos triggers de historico/gamificacao)
5. Registrar log de execucao com sucesso ou erro

### Parte 2: Corrigir os 574 leads retroativamente

Executar um UPDATE em massa para corrigir a origem dos contatos que receberam mensagem com "Linktree" do contato e atualmente nao tem `origin = 'linktree'`:

```text
UPDATE contacts SET origin = 'linktree'
WHERE id IN (
  SELECT DISTINCT c.id
  FROM contacts c
  JOIN conversations conv ON conv.contact_id = c.id
  JOIN messages m ON m.conversation_id = conv.id
  WHERE LOWER(m.content) LIKE '%linktree%'
    AND m.is_from_me = false
    AND (c.origin IS NULL OR c.origin NOT IN ('linktree'))
)
```

## Detalhes Tecnicos

### Campos suportados pelo set_variable (mapeamento)

| Campo UI | Coluna DB (contacts) |
|---|---|
| Nome completo | full_name |
| Email | email |
| Origem | origin |
| Status do Lead | lead_status |
| Observacoes | notes |
| Cidade | city |
| Estado | state |
| Bairro | neighborhood |
| Rua | street |
| Numero | number |
| Complemento | complement |
| CEP | zip_code |
| Pais | country |
| CPF/CNPJ | cpf_cnpj |
| Tipo de Pessoa | person_type |
| Tipo de Contato | contact_type |
| Valor Negociado | negotiated_value |
| Campanha de Origem | origin_campaign |

### Arquivo a modificar

- `supabase/functions/execute-flow-node/index.ts` -- adicionar `case 'set_variable'` no switch (antes da linha 1059)

### Deploy

- Redeployar a Edge Function `execute-flow-node` apos a alteracao
