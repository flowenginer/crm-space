
# Visualizacao de Conversoes na aba CRM do Contato

## O que sera feito

Adicionar uma secao "Conversoes" na aba CRM do modal de Editar Contato, exibindo os dados de vendas registrados via n8n no campo `custom_fields.conversoes`.

## Onde aparece

Na aba **CRM** do modal de edicao do contato, logo abaixo da secao "Dados de Aquisicao (UTMs)". Sera uma secao somente-leitura com visual de lista/cards.

## O que sera exibido

Cada conversao mostrara:
- Numero do pedido
- Valor total (formatado em R$)
- Cidade / UF
- Vendedor
- Data (se disponivel)

Inclui tambem um resumo no topo da secao com:
- Total de conversoes
- Valor total acumulado

## Detalhes Tecnicos

### Arquivo: `src/components/contacts/ContactFormModal.tsx`

1. Ler `initialData?.custom_fields?.conversoes` (array de objetos JSON)
2. Adicionar secao abaixo dos UTMs (dentro da TabsContent "crm"), apenas no modo `edit`
3. Cada item renderizado como um card compacto com as informacoes do pedido
4. Secao so aparece se houver pelo menos 1 conversao registrada
5. Usar `formatCurrency` de `src/lib/format.ts` para formatar valores
6. Usar icones do lucide-react (ShoppingBag, MapPin, User, Hash) para melhorar a leitura

### Estrutura visual

```text
+------------------------------------------+
| ShoppingBag  Conversoes (3)              |
|  Total acumulado: R$ 8.500,00            |
+------------------------------------------+
| #13751  |  R$ 3.742,50  |  Diego        |
| Rio de Janeiro - RJ                      |
+------------------------------------------+
| #13820  |  R$ 1.500,00  |  Eduardo      |
| Sao Paulo - SP                           |
+------------------------------------------+
| #14002  |  R$ 3.257,50  |  Diego        |
| Belo Horizonte - MG                      |
+------------------------------------------+
```

### Nenhuma alteracao de banco de dados necessaria

Os dados ja estao no campo `custom_fields` (JSONB) da tabela `contacts`.
