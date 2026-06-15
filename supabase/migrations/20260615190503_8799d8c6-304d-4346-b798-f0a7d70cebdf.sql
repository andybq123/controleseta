CREATE TABLE IF NOT EXISTS public.protocolo_descricoes_staging (
  numero text PRIMARY KEY,
  descricao text NOT NULL
);
GRANT ALL ON public.protocolo_descricoes_staging TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.protocolo_descricoes_staging TO authenticated;
ALTER TABLE public.protocolo_descricoes_staging ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service only" ON public.protocolo_descricoes_staging FOR ALL USING (false);