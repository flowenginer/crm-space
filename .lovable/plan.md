

# Corrigir Origem de 585 Contatos para "linktree"

## Problema
585 contatos enviaram como primeira mensagem o texto "Olá, vim pelo Linktree..." mas estao com a origem registrada incorretamente (maioria como `meta_ads`).

## Solucao
Executar um UPDATE em massa no campo `origin` da tabela `contacts`, alterando para `linktree` todos os contatos que possuem mensagens com a palavra "Linktree" no conteudo.

## Impacto
- 585 contatos terao sua origem corrigida para `linktree`
- Os dashboards e relatorios de origem/campanha passarao a refletir corretamente a fonte desses leads
- O ranking de criativos por conversao tambem sera impactado positivamente, pois leads antes atribuidos a `meta_ads` agora estarao corretamente categorizados

## Detalhes tecnicos

Sera executado um unico comando SQL:

```sql
UPDATE contacts
SET origin = 'linktree'
WHERE id IN (
  SELECT DISTINCT c.id
  FROM contacts c
  JOIN conversations conv ON conv.contact_id = c.id
  JOIN messages m ON m.conversation_id = conv.id
  WHERE m.is_from_me = false
  AND LOWER(m.content) LIKE '%linktree%'
)
AND (origin IS NULL OR origin != 'linktree');
```

Nenhuma alteracao de schema ou codigo e necessaria. Apenas uma operacao de dados (UPDATE).

