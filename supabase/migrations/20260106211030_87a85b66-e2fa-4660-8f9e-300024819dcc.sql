-- Criar cron job para processar mensagens de marketing a cada 5 minutos
SELECT cron.schedule(
  'process-marketing-messages',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://lkxrmjqrzhaivviuuamp.supabase.co/functions/v1/process-marketing-messages',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxreHJtanFyemhhaXZ2aXV1YW1wIiwicm9sZSI6ImFub25fa2V5IiwiaWF0IjoxNzMzNjYyMzI5LCJleHAiOjIwNDkyMzgzMjl9.D8DPNh2bVFmYn3lFhB5JO_Kq3il-05NRUY3tlH3Z_sg"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
)