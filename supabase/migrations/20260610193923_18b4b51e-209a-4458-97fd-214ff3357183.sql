ALTER TABLE public.email_inbox_log ADD COLUMN IF NOT EXISTS external_id text;
CREATE UNIQUE INDEX IF NOT EXISTS email_inbox_log_account_external_id_key
  ON public.email_inbox_log(account_id, external_id) WHERE external_id IS NOT NULL;

ALTER TABLE public.email_inbox_accounts ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'webhook';
ALTER TABLE public.email_inbox_accounts ADD COLUMN IF NOT EXISTS ultima_sincronizacao timestamptz;