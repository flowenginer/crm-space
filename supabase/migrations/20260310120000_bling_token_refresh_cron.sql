-- Remover job anterior se existir (para evitar duplicatas)
SELECT cron.unschedule('bling-token-refresh')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'bling-token-refresh');

-- Agendar refresh de token Bling a cada 4 horas
-- Substitui a automacao N8N que fazia o mesmo processo
-- A Edge Function bling-token-refresh ja existe e:
--   1. Busca todas as configs ativas em bling_integration_config
--   2. Faz POST em https://www.bling.com.br/Api/v3/oauth/token com refresh_token
--   3. Salva novos access_token e refresh_token de volta na tabela
SELECT cron.schedule(
  'bling-token-refresh',
  '0 */4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://lkxrmjqrzhaivviuuamp.supabase.co/functions/v1/bling-token-refresh',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
