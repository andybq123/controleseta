
-- Tighten RLS: require auth.uid() IS NOT NULL
DROP POLICY IF EXISTS "Autenticados gerenciam secretarias" ON public.secretarias;
CREATE POLICY "Autenticados gerenciam secretarias" ON public.secretarias FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Autenticados gerenciam responsaveis" ON public.responsaveis;
CREATE POLICY "Autenticados gerenciam responsaveis" ON public.responsaveis FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Autenticados gerenciam protocolos" ON public.protocolos;
CREATE POLICY "Autenticados gerenciam protocolos" ON public.protocolos FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Lock down SECURITY DEFINER trigger function
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
