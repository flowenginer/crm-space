
# Unificacao dos 4 Contatos Duplicados

## Resumo

Foram encontrados 4 pares de contatos duplicados (mesmo telefone, formatos diferentes). O plano e manter o contato mais completo (com conversoes, historico, etc.) e transferir qualquer dado util do duplicado antes de exclui-lo.

## Pares identificados

| # | Manter (principal) | Excluir (duplicado) | Acao extra |
|---|---|---|---|
| 1 | CLEITON OS GURI DO AGRO (`8b0e39e9`) - tem conversoes, lead_status, negotiated_value, 2 conversas | CLEITON SANTOS DE LIMA (`2be14f8d`) - vazio, sem conversas | Atualizar nome para versao mais completa |
| 2 | 5521979840013 (`1408c6c2`) - tem conversoes, lead_status, state=RJ, 2 conversas | LEONARDO COELHO DOS SANTOS MACHADO (`92eb21be`) - vazio, 1 conversa | Transferir conversa, atualizar nome |
| 3 | FLAVIO SILVEIRA ROCK & BIKERS (`7925fd15`) - tem conversoes, origin=linktree, negotiated_value, 1 conversa | FLAVIO DA COSTA SILVEIRA (`f73a6d01`) - vazio, sem conversas | Atualizar nome para versao completa |
| 4 | RODRIGO (`57f8a5db`) - tem conversoes, 4 conversas | RODRIGO / GELA MAIS (`8622635b`) - vazio, sem conversas | Atualizar nome para versao completa |

## Etapas da execucao

### 1. Atualizar nomes dos contatos mantidos
Copiar os nomes mais completos dos duplicados para os contatos principais:
- CLEITON: "CLEITON SANTOS DE LIMA / OS GURI DO AGRO"
- LEONARDO: "LEONARDO COELHO DOS SANTOS MACHADO"
- FLAVIO: "FLAVIO DA COSTA SILVEIRA / FLAVIO SILVEIRA ROCK & BIKERS"
- RODRIGO: "RODRIGO / GELA MAIS"

### 2. Transferir conversa do Leonardo
O duplicado `92eb21be` possui 1 conversa que sera movida para o contato principal `1408c6c2`.

### 3. Excluir os 4 contatos duplicados
Remover: `2be14f8d`, `92eb21be`, `f73a6d01`, `8622635b`

## Detalhes tecnicos

Serao executados UPDATE e DELETE diretamente no banco via ferramenta de dados:

1. **UPDATE contacts** SET full_name para os 4 contatos principais
2. **UPDATE conversations** SET contact_id para transferir a conversa do Leonardo
3. **DELETE FROM contacts** WHERE id IN (4 duplicados)

Nenhuma alteracao de schema e necessaria. Apenas operacoes de dados.
