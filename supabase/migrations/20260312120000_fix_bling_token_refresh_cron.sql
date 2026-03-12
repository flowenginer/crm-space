-- Fix: Cron job anterior usava current_setting('app.settings.service_role_key')
-- que pode retornar NULL se o setting nao estiver configurado.
-- Nova abordagem: usar a vault do Supabase ou ler diretamente dos secrets.
-- Tambem reduzir intervalo de 4h para 2h (tokens Bling expiram em 6h).

-- Remover job anterior
SELECT cron.unschedule('bling-token-refresh')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'bling-token-refresh');

-- Agendar refresh de token Bling a cada 2 horas
-- Usa current_setting com fallback para pegar a service_role_key
SELECT cron.schedule(
  'bling-token-refresh',
  '0 */2 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT COALESCE(current_setting('app.settings.supabase_url', true), 'https://lkxrmjqrzhaivviuuamp.supabase.co')) || '/functions/v1/bling-token-refresh',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(
        current_setting('app.settings.service_role_key', true),
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1),
        ''
      )
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
