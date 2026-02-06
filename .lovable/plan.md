
# Corrigir Plataforma e URL do Anuncio no Relatorio de Atendimentos

## Problema Identificado

O banco de dados armazena `referral_data` em **dois formatos diferentes** dependendo da integracao:

- **UAZAPI (nao oficial)**: `{ "sourceApp": "instagram", "sourceUrl": "https://..." }`
- **CloudAPI (oficial)**: `{ "source_url": "https://www.instagram.com/p/...", "source_id": "..." }` (sem campo `sourceApp`)

A RPC `search_conversations_report` so extrai o formato camelCase:
```sql
(c.referral_data->>'sourceApp')::text as referral_source_app,
(c.referral_data->>'sourceUrl')::text as referral_source_url,
```

Resultado: leads vindos da API oficial (CloudAPI) ficam com "Plataforma Anuncio" e "URL Anuncio" vazios no Excel.

## Solucao

Atualizar a RPC para usar `COALESCE` e verificar ambos os formatos, alem de inferir a plataforma a partir da URL quando `sourceApp` nao existir.

## Alteracao

### Migracao SQL - Recriar RPC `search_conversations_report`

Alterar as duas linhas de extracao de referral_data de:

```sql
(c.referral_data->>'sourceApp')::text as referral_source_app,
(c.referral_data->>'sourceUrl')::text as referral_source_url,
```

Para:

```sql
COALESCE(
  c.referral_data->>'sourceApp',
  CASE
    WHEN c.referral_data->>'source_url' ILIKE '%instagram.com%' THEN 'instagram'
    WHEN c.referral_data->>'source_url' ILIKE '%facebook.com%' OR c.referral_data->>'source_url' ILIKE '%fb.me%' THEN 'facebook'
    ELSE NULL
  END
)::text as referral_source_app,
COALESCE(
  c.referral_data->>'sourceUrl',
  c.referral_data->>'source_url'
)::text as referral_source_url,
```

Isso garante que:
- Se `sourceApp` existe (UAZAPI), usa diretamente
- Se nao existe (CloudAPI), infere a plataforma pela URL (`instagram.com` = Instagram, `facebook.com`/`fb.me` = Facebook)
- Para URL, tenta `sourceUrl` (camelCase) primeiro, depois `source_url` (snake_case)

## Arquivos Alterados

- Nova migracao SQL para recriar a RPC `search_conversations_report`

## Complexidade

**Muito baixa** - apenas ajuste em 2 expressoes SQL dentro da RPC existente.
