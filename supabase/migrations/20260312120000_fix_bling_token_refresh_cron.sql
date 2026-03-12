-- Fix: Cron job anterior usava current_setting('app.settings.service_role_key')
-- que retorna NULL no Supabase (permissao negada para setar).
-- Nova abordagem: armazenar a service_role_key no Vault do Supabase.
-- Tambem reduzir intervalo de 4h para 2h (tokens Bling expiram em 6h).

-- PASSO 1: Armazene sua service_role_key no Vault ANTES de rodar esta migration.
-- Execute no SQL Editor do Supabase:
--   SELECT vault.create_secret('SUA_SERVICE_ROLE_KEY_AQUI', 'service_role_key');
--
-- Para encontrar sua service_role_key:
--   Supabase Dashboard > Settings > API > service_role (secret)

-- Remover job anterior
SELECT cron.unschedule('bling-token-refresh')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'bling-token-refresh');

-- Agendar refresh de token Bling a cada 2 horas
-- Le a service_role_key do Vault do Supabase
SELECT cron.schedule(
  'bling-token-refresh',
  '0 */2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://lkxrmjqrzhaivviuuamp.supabase.co/functions/v1/bling-token-refresh',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1),
        ''
      )
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
