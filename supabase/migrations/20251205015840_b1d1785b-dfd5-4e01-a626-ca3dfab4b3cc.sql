-- Create cron job to process scheduled messages every minute
SELECT cron.schedule(
  'process-scheduled-messages',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://lkxrmjqrzhaivviuuamp.supabase.co/functions/v1/process-scheduled-messages',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxreHJtanFyemhhaXZ2aXV1YW1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4MDA0NTksImV4cCI6MjA4MDM3NjQ1OX0.h5Z0o7OwO_P-IzC29MA20VJ9W6Ch0tyecrzobXbjju8"}'::jsonb,
    body:='{}'::jsonb
  ) AS request_id;
  $$
);