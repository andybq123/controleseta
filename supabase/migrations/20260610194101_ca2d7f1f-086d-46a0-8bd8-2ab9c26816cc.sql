CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule('gmail-sync-protocolos') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'gmail-sync-protocolos');

SELECT cron.schedule(
  'gmail-sync-protocolos',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--3c8fcc86-0901-46c9-8796-de8a493f7bde.lovable.app/api/public/gmail-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yaHJzcHRwcnBmYmt5ZmRzc2htIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NDA2OTAsImV4cCI6MjA5NjUxNjY5MH0.FCxyGQvIAVwz4G-nBR-4gWkWxVxWW83tZuYggsbVnOw'
    ),
    body := '{}'::jsonb
  );
  $$
);