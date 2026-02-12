
# Criar Registro de Conversão para 168 Leads

## Objetivo
Preencher automaticamente o campo `conversoes` no `custom_fields` dos 168 leads que receberam a mensagem de dados cadastrais, possuem valor negociado mas não têm conversão registrada.

## O que será feito

1. **Executar um UPDATE em massa** no banco de dados para adicionar um registro de conversão no `custom_fields` de cada um dos 168 contatos
2. Cada registro de conversão será criado com:
   - **total**: valor do campo `negotiated_value` do contato
   - **data**: data de hoje (2026-02-12) como referência
   - **numero_pedido**: vazio (não temos essa info)
   - **cidade/uf/vendedor**: preenchidos a partir do `custom_fields` existente, se disponíveis

## Detalhes Técnicos

O UPDATE será feito diretamente no banco via SQL, atualizando o campo `custom_fields` com `jsonb_set` para adicionar o array `conversoes` com um registro baseado no `negotiated_value`:

```sql
UPDATE contacts
SET custom_fields = jsonb_set(
  COALESCE(custom_fields, '{}'::jsonb),
  '{conversoes}',
  jsonb_build_array(
    jsonb_build_object(
      'total', negotiated_value,
      'data', '2026-02-12',
      'numero_pedido', '',
      'cidade', COALESCE(custom_fields->>'cidade', ''),
      'uf', COALESCE(custom_fields->>'uf', ''),
      'vendedor', COALESCE(custom_fields->>'vendedor', '')
    )
  )
)
WHERE id IN (subquery dos 168 leads)
AND (custom_fields->'conversoes' IS NULL OR jsonb_array_length(custom_fields->'conversoes') = 0)
AND negotiated_value > 0;
```

## Impacto
- **168 contatos** terão o campo de conversão preenchido
- **Valor total**: R$ 193.988,18
- Nenhum dado existente será sobrescrito (apenas leads SEM conversão serão afetados)
- A operação é segura pois verifica novamente as condições antes de atualizar
