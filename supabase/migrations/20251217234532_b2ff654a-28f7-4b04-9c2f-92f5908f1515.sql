-- Schedule the rescue message processor to run every minute
SELECT cron.schedule(
  'process-rescue-messages',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://lkxrmjqrzhaivviuuamp.supabase.co/functions/v1/process-rescue-messages',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);