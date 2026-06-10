-- Tables for inbound-email ingestion to auto-create protocols

CREATE TABLE public.email_inbox_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  descricao text,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  ativo boolean NOT NULL DEFAULT true,
  secretaria_id uuid REFERENCES public.secretarias(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_inbox_accounts TO authenticated;
GRANT ALL ON public.email_inbox_accounts TO service_role;

ALTER TABLE public.email_inbox_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados gerenciam contas de email"
  ON public.email_inbox_accounts FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE TRIGGER trg_email_inbox_accounts_updated_at
  BEFORE UPDATE ON public.email_inbox_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE public.email_inbox_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES public.email_inbox_accounts(id) ON DELETE SET NULL,
  remetente text,
  destinatario text,
  assunto text,
  corpo text,
  status text NOT NULL DEFAULT 'pendente', -- pendente, processado, erro, ignorado
  erro text,
  protocolo_id uuid REFERENCES public.protocolos(id) ON DELETE SET NULL,
  recebido_em timestamptz NOT NULL DEFAULT now(),
  processado_em timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_inbox_log TO authenticated;
GRANT ALL ON public.email_inbox_log TO service_role;

ALTER TABLE public.email_inbox_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem log de emails"
  ON public.email_inbox_log FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Autenticados removem log de emails"
  ON public.email_inbox_log FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE INDEX idx_email_inbox_log_recebido ON public.email_inbox_log (recebido_em DESC);
CREATE INDEX idx_email_inbox_log_account ON public.email_inbox_log (account_id);