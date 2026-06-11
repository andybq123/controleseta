
-- 1) email_inbox_accounts: admin only (contains IMAP password & webhook token)
DROP POLICY IF EXISTS "Autenticados gerenciam contas de email" ON public.email_inbox_accounts;
CREATE POLICY "Admins gerenciam contas de email" ON public.email_inbox_accounts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2) email_inbox_log: admin only (contains email bodies)
DROP POLICY IF EXISTS "Autenticados leem log de emails" ON public.email_inbox_log;
DROP POLICY IF EXISTS "Autenticados removem log de emails" ON public.email_inbox_log;
CREATE POLICY "Admins leem log de emails" ON public.email_inbox_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins removem log de emails" ON public.email_inbox_log
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3) protocolo_historico: SELECT for authenticated remains (audit trail).
--    Remove INSERT policy — historico is written only by SECURITY DEFINER trigger which bypasses RLS.
DROP POLICY IF EXISTS "Autenticados inserem historico" ON public.protocolo_historico;

-- 4) responsaveis: SELECT for authenticated (needed for form dropdowns); writes admin only
DROP POLICY IF EXISTS "Autenticados gerenciam responsaveis" ON public.responsaveis;
CREATE POLICY "Autenticados leem responsaveis" ON public.responsaveis
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins escrevem responsaveis" ON public.responsaveis
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins atualizam responsaveis" ON public.responsaveis
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins removem responsaveis" ON public.responsaveis
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 5) user_roles: explicit admin-only INSERT/UPDATE/DELETE policies
CREATE POLICY "Admins inserem roles" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins atualizam roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins removem roles" ON public.user_roles
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 6) Revoke EXECUTE on SECURITY DEFINER functions from anon (still callable by authenticated for RLS)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.log_protocolo_changes() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;
