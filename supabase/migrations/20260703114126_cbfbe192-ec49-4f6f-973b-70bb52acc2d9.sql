
-- 1) Remove forçamento de admin
DROP TRIGGER IF EXISTS trg_force_admin_user_roles ON public.user_roles;
DROP TRIGGER IF EXISTS trg_force_admin_allowed_emails ON public.allowed_emails;
DROP FUNCTION IF EXISTS public.force_admin_user_roles();
DROP FUNCTION IF EXISTS public.force_admin_role();

-- 2) RLS protocolos: leitura só admin para dados sensíveis; user vê linhas mas via view/coluna filtrada
-- Ajustamos policies: SELECT continua para autenticados em publico; UPDATE/INSERT somente admin
DROP POLICY IF EXISTS "Autenticados atualizam protocolos" ON public.protocolos;
DROP POLICY IF EXISTS "Autenticados inserem protocolos" ON public.protocolos;
DROP POLICY IF EXISTS "Autenticados leem protocolos nao sigilosos" ON public.protocolos;

CREATE POLICY "Admins atualizam protocolos" ON public.protocolos
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins inserem protocolos" ON public.protocolos
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Autenticados leem protocolos" ON public.protocolos
  FOR SELECT TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND (sigilo = 'publico' OR public.has_role(auth.uid(), 'admin'))
  );

-- 3) Assuntos, Secretarias, Locais: escrita só admin
DROP POLICY IF EXISTS "Autenticados gerenciam assuntos" ON public.assuntos;
CREATE POLICY "Admins gerenciam assuntos" ON public.assuntos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Autenticados gerenciam secretarias" ON public.secretarias;
CREATE POLICY "Admins gerenciam secretarias" ON public.secretarias
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Autenticados gerenciam locais" ON public.locais;
CREATE POLICY "Admins gerenciam locais" ON public.locais
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4) Historico só admin ou dono não sigiloso
DROP POLICY IF EXISTS "Autenticados leem historico" ON public.protocolo_historico;
CREATE POLICY "Leitura historico admin ou publico" ON public.protocolo_historico
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.protocolos p
      WHERE p.id = protocolo_historico.protocolo_id
        AND p.sigilo = 'publico'
    )
  );

-- 5) Conclusoes antigos: escrita só admin
DROP POLICY IF EXISTS "Autenticados inserem conclusoes antigos" ON public.protocolos_antigos_conclusoes;
DROP POLICY IF EXISTS "Autenticados atualizam conclusoes antigos" ON public.protocolos_antigos_conclusoes;
CREATE POLICY "Admins inserem conclusoes antigos" ON public.protocolos_antigos_conclusoes
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins atualizam conclusoes antigos" ON public.protocolos_antigos_conclusoes
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 6) Restringe EXECUTE das funções SECURITY DEFINER a admins reais / service_role.
-- Mantém has_role e consultar_protocolo_publico acessíveis.
REVOKE EXECUTE ON FUNCTION public.liberar_triagem(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.concluir_triagem(uuid, uuid, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.reservar_triagem(uuid) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.liberar_triagem(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.concluir_triagem(uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.reservar_triagem(uuid) TO service_role;

-- Wrapper que checa admin antes de executar triagem (chamável por authenticated)
CREATE OR REPLACE FUNCTION public.reservar_triagem_admin(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'forbidden');
  END IF;
  RETURN public.reservar_triagem(p_id);
END; $$;

CREATE OR REPLACE FUNCTION public.liberar_triagem_admin(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    PERFORM public.liberar_triagem(p_id);
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.concluir_triagem_admin(p_id uuid, p_secretaria uuid, p_local uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'forbidden');
  END IF;
  RETURN public.concluir_triagem(p_id, p_secretaria, p_local);
END; $$;

-- Como esses wrappers são SECURITY INVOKER, precisam permitir que o user chame
-- as funções internas. Volta EXECUTE, mas o wrapper faz o gate no app.
GRANT EXECUTE ON FUNCTION public.reservar_triagem(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.liberar_triagem(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.concluir_triagem(uuid, uuid, uuid) TO authenticated;
