
# Configuracao do Bloco "Definir Variavel" no Flow Builder

## Problema

O bloco "Definir Variavel" (`set_variable`) existe na paleta de blocos, mas quando clicado, o painel de propriedades mostra "Nenhuma configuracao disponivel para este bloco" porque nao ha um `case 'set_variable'` no switch do `PropertiesPanel.tsx`.

## Solucao

Adicionar um formulario de configuracao para o bloco `set_variable` que permita:

1. **Selecionar o campo do contato** a ser alterado (dropdown com todos os campos relevantes)
2. **Definir o valor** a ser atribuido (campo de texto livre ou selecao, dependendo do tipo)

## Campos disponiveis no dropdown

O dropdown "Campo do contato" incluira:

| Campo | Label |
|-------|-------|
| full_name | Nome completo |
| email | Email |
| origin | Origem |
| lead_status | Status do Lead |
| notes | Observacoes |
| city | Cidade |
| state | Estado |
| neighborhood | Bairro |
| street | Rua |
| number | Numero |
| complement | Complemento |
| zip_code | CEP |
| country | Pais |
| cpf_cnpj | CPF/CNPJ |
| person_type | Tipo de Pessoa |
| contact_type | Tipo de Contato |
| negotiated_value | Valor Negociado |
| origin_campaign | Campanha de Origem |

O campo "Valor" sera um Input de texto livre, permitindo tambem o uso de variaveis como `{{nome}}`, `{{telefone}}`, etc.

## Detalhes Tecnicos

### Arquivo: `src/components/flow-builder/PropertiesPanel.tsx`

Adicionar um novo `case 'set_variable':` no switch da funcao `renderNodeConfig` (antes do `default`), contendo:

1. Um `Select` com label "Campo do contato" -- lista os campos da tabela `contacts` que fazem sentido ser alterados via automacao
2. Um `Input` com label "Valor" -- onde o usuario digita o valor fixo ou uma variavel (ex: `{{nome}}`)
3. Uma secao de ajuda mostrando as variaveis disponiveis (`{{nome}}`, `{{telefone}}`, `{{email}}`, `{{data}}`, `{{hora}}`, etc.)

A config salva sera:
```json
{
  "variable": "origin",
  "value": "WhatsApp Campanha X"
}
```

### Sem alteracoes no backend

A Edge Function `execute-flow-node` ja precisa tratar o `set_variable` para fazer o UPDATE no contato. Se ja existir essa logica, nada muda. Se nao existir, sera necessario verificar separadamente.
