
# Plano: Correção em Massa de Triggers não Disparados

## Diagnóstico da Situação

Foram encontradas **muitas mensagens que podem ter perdido triggers**:

| Tenant | Trigger | Mensagens não processadas (7 dias) |
|--------|---------|-----------------------------------|
| Master (664dfcb4) | "Cadastramento", "Vi que iniciou", etc. | ~5.146 mensagens |
| Space Sports (00000001) | "acaba de ser enviado para produção" | ~17.669 mensagens |

**Importante**: Nem todas essas mensagens deveriam ter disparado automações - elas apenas não foram marcadas como `trigger_processed`. O sistema precisa verificar quais realmente correspondem aos triggers configurados.

---

## Solução: Edge Function de Reprocessamento em Massa

Criar uma nova Edge Function `reprocess-missed-triggers` que:

1. **Busca mensagens não processadas** que correspondem às keywords dos fluxos ativos
2. **Verifica se a automação já foi executada** para evitar duplicatas
3. **Dispara o trigger** chamando `process-flow-triggers`
4. **Marca como processada** após execução
5. **Processa em lotes** para não sobrecarregar o sistema

### Arquitetura

```
reprocess-missed-triggers
├── Recebe parâmetros (tenant_id, trigger_type, limit, days_back)
├── Busca fluxos ativos com triggers keyword/message_key
├── Para cada fluxo:
│   ├── Extrai keywords do config
│   ├── Busca mensagens que contêm essas keywords
│   │   ├── is_from_me = true (para message_key) OU false (para keyword)
│   │   ├── trigger_processed = false
│   │   └── Período configurado (ex: últimos 7 dias)
│   ├── Para cada mensagem:
│   │   ├── Verifica se já existe execução para contact_id + flow_id
│   │   ├── Se não existe → invoca process-flow-triggers
│   │   └── Marca trigger_processed = true
│   └── Retorna estatísticas
└── Suporta processamento em lotes com delay entre chamadas
```

---

## Código da Edge Function

**Arquivo: `supabase/functions/reprocess-missed-triggers/index.ts`**

```typescript
interface ReprocessRequest {
  tenant_id: string;          // Obrigatório: qual tenant processar
  trigger_type?: 'message_key' | 'keyword' | 'all';  // Padrão: 'all'
  days_back?: number;         // Padrão: 7
  batch_size?: number;        // Padrão: 50
  dry_run?: boolean;          // Padrão: false (apenas simular)
}

// Fluxo de processamento:
// 1. Buscar fluxos ativos com triggers relevantes
// 2. Para cada fluxo, buscar mensagens correspondentes
// 3. Filtrar mensagens que já tiveram execução
// 4. Invocar process-flow-triggers para as novas
// 5. Marcar como processadas
// 6. Retornar estatísticas detalhadas
```

---

## Interface de Administração

Adicionar um botão na página de administração ou criar uma rota `/admin/reprocess-triggers` que permita:

1. **Selecionar tenant** (ou "todos")
2. **Selecionar período** (últimos 1, 3, 7, 14, 30 dias)
3. **Modo dry-run** para simular antes de executar
4. **Visualizar progresso** em tempo real
5. **Log de resultados** mostrando quantas automações foram disparadas

---

## Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| `supabase/functions/reprocess-missed-triggers/index.ts` | Criar nova Edge Function |
| `src/pages/admin/ReprocessTriggersPage.tsx` | Criar interface de administração |
| `src/App.tsx` | Adicionar rota `/admin/reprocess-triggers` |

---

## Segurança

1. **Verificação de permissão**: Apenas admins podem executar
2. **Rate limiting**: Máximo de 50 mensagens por lote com delay de 100ms
3. **Deduplicação**: Verificar `flow_executions` antes de disparar
4. **Logging**: Registrar todas as ações para auditoria

---

## Exemplo de Uso

```bash
# Via curl (para teste)
curl -X POST https://[project].supabase.co/functions/v1/reprocess-missed-triggers \
  -H "Authorization: Bearer [token]" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "664dfcb4-5432-4c14-9838-7db14360cabf",
    "trigger_type": "message_key",
    "days_back": 7,
    "dry_run": true
  }'

# Resposta esperada (dry_run):
{
  "success": true,
  "dry_run": true,
  "summary": {
    "flows_checked": 6,
    "messages_matched": 234,
    "already_executed": 180,
    "would_trigger": 54
  },
  "details": [
    {
      "flow_name": "EMPREGA MAIS - PROTOCOLO AGENDAMENTO",
      "keyword": "Cadastramento",
      "messages_found": 45,
      "would_trigger": 12
    }
  ]
}
```

---

## Benefícios

1. **Correção retroativa**: Todas as automações perdidas serão reprocessadas
2. **Segurança**: Modo dry-run para validar antes de executar
3. **Deduplicação**: Não cria execuções duplicadas
4. **Escalabilidade**: Processamento em lotes para não sobrecarregar
5. **Auditabilidade**: Logs detalhados de cada ação
6. **Reutilizável**: Pode ser executado novamente a qualquer momento
