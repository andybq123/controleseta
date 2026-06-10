
ALTER TABLE public.email_inbox_accounts
  ADD COLUMN IF NOT EXISTS ultima_sync_novos INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ultima_sync_erros INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ultima_sync_processados INTEGER NOT NULL DEFAULT 0;

-- Wipe operational data to start fresh
DELETE FROM public.protocolo_historico;
DELETE FROM public.email_inbox_log;
DELETE FROM public.protocolos;
