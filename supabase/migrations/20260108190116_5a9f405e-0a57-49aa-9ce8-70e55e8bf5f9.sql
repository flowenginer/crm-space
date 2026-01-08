-- Habilitar extensão pg_cron (já habilitada por padrão no Supabase)
-- create extension if not exists pg_cron with schema extensions;

-- Habilitar extensão pg_net para fazer HTTP requests
create extension if not exists pg_net with schema extensions;

-- Remover job anterior se existir (para evitar duplicatas)
SELECT cron.unschedule('sync-whatsapp-channels') 
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-whatsapp-channels');

-- Agendar sincronização a cada 3 minutos
SELECT cron.schedule(
  'sync-whatsapp-channels',
  '*/3 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://lkxrmjqrzhaivviuuamp.supabase.co/functions/v1/sync-whatsapp-channels',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);