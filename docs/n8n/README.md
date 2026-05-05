# n8n — Import de Leads + Distribuição (CRM-Space)

Workflow: `crm-import-leads-distribution.json`

## Como importar

1. n8n → **Workflows → Import from File** → selecione o JSON.
2. Vá em **Settings → Variables** (n8n self-hosted) e crie:

| Variável                     | Valor                                                       |
| ---------------------------- | ----------------------------------------------------------- |
| `SUPABASE_URL`               | `https://lkxrmjqrzhaivviuuamp.supabase.co`                  |
| `TENANT_ID`                  | UUID do seu tenant                                          |
| `REDIRECT_CAMPAIGN_ID`       | UUID de uma `redirect_campaigns` ativa no CRM               |
| `SUPABASE_SERVICE_ROLE_KEY`  | Service Role key do projeto Supabase (apenas server-side!)  |

> Sem suporte a `$vars` (n8n cloud antigo)? Substitua nos nós HTTP por valores diretos ou use Credenciais HTTP Header Auth.

3. Ative o workflow e copie a URL do nó **Webhook In** (`POST /webhook/crm-import-leads`).

## Como chamar

```bash
curl -X POST https://<seu-n8n>/webhook/crm-import-leads \
  -H "Content-Type: application/json" \
  -d '[
    {
      "igsid": "1025652609788350",
      "nome_contato": "Marivaldo",
      "relacao_contato": "Pai",
      "nome_responsavel": "Marivaldo Josias Goes",
      "telefone_responsavel": "21992731918",
      "nome_jovem": "Cristiano Ronaldo da Silva",
      "idade_jovem": "19",
      "bairro": "Alcantara"
    }
  ]'
```

Aceita um único objeto, um array, ou `{ "body": [...] }`.

## Pipeline

```
Webhook In
  └─ Normalize Input        (aceita array/objeto)
     └─ Split Leads          (1 item por execução do loop)
        └─ Loop Items
           ├─ done → Respond OK
           └─ next → Sanitize Fields              (remove "undefined")
                     └─ HTTP — redirect-capture   (cria contato + conversa)
                        └─ PATCH — Enriquecer     (full_name + referral_data)
                           └─ HTTP — distribute-lead (joga na fila)
                              └─ Throttle 1s → volta ao Loop
```

## Endpoints utilizados

- `POST {SUPABASE_URL}/functions/v1/redirect-capture` — cria/upserta contato
  (`supabase/functions/redirect-capture/index.ts`).
- `PATCH {SUPABASE_URL}/rest/v1/contacts?id=eq.<id>` — enriquece campos extras.
- `POST {SUPABASE_URL}/functions/v1/distribute-lead` — distribuição round-robin
  ou percentual conforme `company_settings.lead_distribution_*`
  (`supabase/functions/distribute-lead/index.ts`).

## Notas importantes

- **Tenant Master** do sistema: `00000000-0000-0000-0000-000000000001` (não use
  como tenant operacional — use o seu).
- **Telefone**: pode mandar cru (`21992731918`); a função normaliza para
  `5521992731918` e dedup por `(phone, tenant_id)`.
- **Distribuição não atribui** se a conversa já tem agente ou houve transfer
  manual nos últimos 60s. Para forçar, adicione no body do `distribute-lead`:
  `"force_department_id": "<UUID>"`.
- **Throttle 1s** evita rate limit em imports grandes — ajuste se precisar.
- **Service Role key**: nunca exponha no front. Se preferir não usar, crie uma
  Edge Function `n8n-enrich-contact` que receba os campos extras e faça o
  update server-side, e remova o nó `PATCH — Enriquecer Contato`.
