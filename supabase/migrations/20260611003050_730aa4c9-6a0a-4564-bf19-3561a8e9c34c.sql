ALTER TABLE public.email_inbox_accounts
  ADD COLUMN IF NOT EXISTS imap_host text,
  ADD COLUMN IF NOT EXISTS imap_port integer DEFAULT 993,
  ADD COLUMN IF NOT EXISTS imap_user text,
  ADD COLUMN IF NOT EXISTS imap_password text,
  ADD COLUMN IF NOT EXISTS imap_tls boolean DEFAULT true;