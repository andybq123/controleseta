
-- 1. Revoke EXECUTE on trigger-only SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_protocolo_changes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.stamp_triagem_conclusao() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.force_triagem_para_ouvidoria() FROM PUBLIC, anon, authenticated;

-- 2. Tighten EXECUTE on RPC functions to authenticated only (anon doesn't need them)
REVOKE EXECUTE ON FUNCTION public.reservar_triagem(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.concluir_triagem(uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.liberar_triagem(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reservar_triagem(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.concluir_triagem(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.liberar_triagem(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
-- consultar_protocolo_publico stays callable by anon (public consultation endpoint)

-- 3. profiles: restrict SELECT to own row or admin
DROP POLICY IF EXISTS "Usuarios autenticados leem perfis" ON public.profiles;
CREATE POLICY "Usuario le seu proprio perfil"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

-- 4. protocolos: split the catch-all ALL policy; restrict confidential rows to admins,
--    and limit DELETE to admins. Realtime delivery now respects sigilo.
DROP POLICY IF EXISTS "Autenticados gerenciam protocolos" ON public.protocolos;

CREATE POLICY "Autenticados leem protocolos nao sigilosos"
  ON public.protocolos
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND (sigilo = 'publico' OR public.has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "Autenticados inserem protocolos"
  ON public.protocolos
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Autenticados atualizam protocolos"
  ON public.protocolos
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND (sigilo = 'publico' OR public.has_role(auth.uid(), 'admin'))
  )
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins removem protocolos"
  ON public.protocolos
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 5. protocolos_antigos_conclusoes: replace USING true / WITH CHECK true ALL policy
DROP POLICY IF EXISTS "Autenticados gerenciam conclusoes antigos" ON public.protocolos_antigos_conclusoes;

CREATE POLICY "Autenticados inserem conclusoes antigos"
  ON public.protocolos_antigos_conclusoes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Autenticados atualizam conclusoes antigos"
  ON public.protocolos_antigos_conclusoes
  FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins removem conclusoes antigos"
  ON public.protocolos_antigos_conclusoes
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
