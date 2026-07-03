-- Store cron shared secret in Vault and update gmail-sync cron to send Authorization header
DO $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM vault.secrets WHERE name = 'cron_secret';
  IF v_id IS NULL THEN
    PERFORM vault.create_secret('7gJ6xIRZ0LT9MQW4eAvpOgWtPAL6ejXk6h3_Paxv1fAPpBNm-82M9xowECU0rvBm', 'cron_secret');
  ELSE
    PERFORM vault.update_secret(v_id, '7gJ6xIRZ0LT9MQW4eAvpOgWtPAL6ejXk6h3_Paxv1fAPpBNm-82M9xowECU0rvBm');
  END IF;
END $$;

SELECT cron.unschedule('gmail-sync-protocolos') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'gmail-sync-protocolos');

SELECT cron.schedule(
  'gmail-sync-protocolos',
  '*/5 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://project--3c8fcc86-0901-46c9-8796-de8a493f7bde.lovable.app/api/public/gmail-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $cron$
);