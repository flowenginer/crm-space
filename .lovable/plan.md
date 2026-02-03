
## Objetivo (o que você pediu)
1) Listar todas as automações (fluxos) do tenant **Master**.  
2) “Entrar em cada automação”, olhar os **logs de execução** e validar se, para cada lead que passou, o resultado foi **efetivo** (principalmente atualização de status).  
3) Corrigir o que estiver causando o problema (inclusive quando “parece que não atualizou”, mas na verdade atualizou e a UI não refletiu).

---

## O que eu já consegui confirmar pelos dados (Master)
### Automações (fluxos) existentes no Master (tenant_id = 664dfcb4-5432-4c14-9838-7db14360cabf)
Ativas:
- **EMPREGA MAIS - PROTOCOLO AGENDAMENTO** (3 nós, 2 conexões, trigger `message_key`)
- **EMPREGA MAIS - TREINAMENTO / MATRICULA** (3 nós, 2 conexões, trigger `message_key`)
- **EMPREGA MAIS - TREINAMENTO** (3 nós, 2 conexões, trigger `message_key`)
- **EMPREGA MAIS SDR** (15 nós, 19 conexões, trigger `message_key`)
- **EMPREGA MAIS - POS VISITA** (3 nós, 2 conexões, trigger `message_key`)
- **EMPREGA MAIS - PALESTRA** (3 nós, 2 conexões, trigger `message_key`)

Inativa:
- TESTE AUTOMACAO (sem nós)

### Evidência importante: pelo menos uma automação atualizou status “de verdade”
No fluxo **EMPREGA MAIS - PROTOCOLO AGENDAMENTO** eu encontrei execução recente com logs:
- “Executando nó: set_lead_status”
- “Status alterado para: Agendado”
E o `lead_status_history` registrou a mudança (changed_by = null, típico de automação/Service Role).

### Então por que “parece que não atualizou” para você?
Encontrei um indício forte de problema de **sincronização / exibição**:
- A automação atualiza `contacts.lead_status`.
- A lista de conversas e alguns pontos do app também usam `conversations.lead_status`.
- Existem triggers no banco para sincronizar **conversa → contato**, mas não encontrei (pelo que foi possível ver) sincronização robusta de **contato → conversa** para `lead_status`.
- Exemplo real que apareceu: o contato já teve status alterado por automação, mas `conversations.lead_status` continua “new”.

Resultado: o atendimento vê “não mudou” porque a tela está lendo/filtrando/mostrando o campo errado (ou não está recebendo evento de update), mesmo quando o status do contato mudou corretamente.

Além disso, encontrei outro cenário que confunde:
- O status muda por automação, mas pode ser **alterado depois** manualmente por um atendente ou por outra rotina; aí, olhando “agora”, parece que a automação “não funcionou”, mas ela funcionou e foi sobrescrita mais tarde (o histórico mostra isso).

---

## Plano de correção e auditoria (detalhe por detalhe)

### Entrega A — Auditoria completa “automação por automação” (com prova de efetividade)
Vou criar um “modo auditoria” (tela interna) que:
1) Lista todos os fluxos do Master (ativos/inativos) e mostra saúde:
   - contagem de nós/conexões
   - últimos disparos
   - quantas execuções estão `completed`, `waiting_*`, `running`, `error`
   - últimos erros por fluxo (se houver)
2) Para cada automação, abre uma visão de “Execuções recentes”, com:
   - dados do gatilho (trigger_type, mensagem_original, ultima_resposta)
   - sequência de logs (flow_execution_logs)
   - verificação automática do resultado do status (quando existir bloco `set_lead_status`):
     - Status pretendido (do nó)
     - Log “Status alterado para: X”
     - Registro correspondente em `lead_status_history` (timestamp aproximado)
     - `contacts.lead_status` atual
     - `conversations.lead_status` atual (da conversa da execução e/ou conversas abertas do contato)
3) Marca cada execução com um “veredito”:
   - **Efetivo**: log + histórico + status atual coerente (ou coerente no momento e depois sobrescrito)
   - **Efetivo mas sobrescrito**: automação alterou, mas depois alguém/outro fluxo alterou novamente (mostrando quem/quando pelo histórico)
   - **Não efetivo**: não houve log de status / houve erro / execução não chegou no nó

Isso resolve seu pedido “analítico, detalhe por detalhe”, sem depender de “achismos” e sem você precisar abrir manualmente cada log no Supabase.

#### Observação de segurança/permissões
Essa tela será restrita a usuários autorizados (ex.: admin/supervisor), e filtrada pelo tenant Master.

---

### Entrega B — Correção definitiva da inconsistência “status mudou mas a UI não reflete”
Vou implementar sincronização explícita para garantir consistência e atualização em tempo real:

1) **No Edge Function `execute-flow-node`**, no bloco `set_lead_status`:
   - manter `contacts.lead_status = X`
   - também atualizar `conversations.lead_status = X` (pelo menos a `execution.conversation_id`; opcionalmente todas as conversas `open/pending` daquele contato)
   - adicionar log detalhado (antes/depois) para auditoria

2) **No banco**, adicionar um trigger/função (via migration) para garantir que qualquer mudança em `contacts.lead_status` (seja manual ou por automação) sincronize `conversations.lead_status` das conversas abertas/pending do contato.
   - Isso evita que o problema volte mesmo se outro ponto do sistema atualizar o contato.

3) Garantir que a UI (lista `/conversations`) receba atualização:
   - Atualizar `conversations` dispara Realtime/invalidations com mais consistência do que depender apenas de `contacts` (varia por tela e cache).
   - Resultado: o atendente “vê na hora”.

---

### Entrega C — Auditoria e correção de “execuções presas / running demais”
Eu vi que no Master existe um volume significativo de execuções do fluxo **EMPREGA MAIS SDR** em `running`.

Vou:
1) Criar um diagnóstico automático no painel:
   - execuções `running` com `last_activity_at` antigo
   - nó atual (`current_node_id`) e subtype
   - últimas linhas de log (se houver)
2) Ajustar robustez em pontos críticos:
   - **`whatsapp-webhook` (retomada de waiting flows)**: se não encontrar conexão para o `source_handle` calculado, registrar log claro e finalizar execução (ou devolver para waiting com mensagem), evitando “running eterno”.
   - adicionar logs e padronizar para ficar rastreável.
3) Opcional (com sua aprovação): criar uma rotina segura de “limpeza”:
   - marcar execuções “obviamente presas” como `completed`/`error` com `error_message` para não poluir o painel e não confundir operação.

---

### Entrega D — “Prova de versão” nos Edge Functions (para não termos deploy “fantasma”)
Para evitar a sensação de “você disse que corrigiu e não corrigiu”, vou aplicar o padrão de versionamento:
- adicionar `const VERSION = "YYYY-MM-DD.HHMM"` em:
  - `process-flow-triggers`
  - `execute-flow-node`
  - `process-flow-delays`
  - (e onde mais for necessário)
- logar `[VERSION]` no início de cada request
- incluir `_version` no JSON de resposta quando aplicável

Assim, você consegue olhar o log e saber exatamente qual código está rodando.

---

## Sequência de execução (rápida e segura)
1) Implementar **sincronização status contato → conversa** (Edge Function + trigger no DB).  
2) Implementar o **Painel de Auditoria** (listagem de fluxos + drilldown por execução).  
3) Implementar **correções de execuções presas** + logs melhores.  
4) Adicionar **versionamento** nos Edge Functions.  
5) Validar end-to-end com 2 a 3 conversas reais do Master (gatilho → execução → status → UI).

---

## Critérios de sucesso (o que precisa acontecer para você “sentir” que resolveu)
1) Ao disparar uma automação do Master que altera status, você vê:
   - Status do contato atualizado
   - Status na lista de conversas atualizado (sem precisar recarregar)
2) No painel, cada execução mostra:
   - quais nós rodaram
   - se o status foi efetivo
   - se foi sobrescrito depois (com evidência do histórico)
3) Execuções presas viram exceção, não regra, e ficam claramente identificadas.

---

## Riscos e cuidados
- Sincronizar `conversations.lead_status` precisa ser feito com critério (ex.: apenas conversas `open/pending`) para não “reescrever história” em conversas antigas/fechadas.
- Mudanças no banco (trigger) exigem atenção para multi-tenant e performance; farei a função de forma objetiva e index-friendly.
- O painel de auditoria deve evitar expor dados desnecessários para usuários sem permissão.

---

## O que eu preciso de você (para ficar 100% certeiro)
Assim que eu sair do modo planejamento e começar a implementar, vou precisar de:
- 2 exemplos de conversas/leads onde “era para ter mudado o status e não mudou” (IDs ou telefone/nome) para eu bater exatamente com o que você está vendo.

