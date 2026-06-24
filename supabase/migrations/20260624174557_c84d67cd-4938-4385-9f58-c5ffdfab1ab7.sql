
ALTER TABLE public.protocolos
  ADD COLUMN IF NOT EXISTS url text,
  ADD COLUMN IF NOT EXISTS detalhes jsonb,
  ADD COLUMN IF NOT EXISTS coletado_em timestamptz;

CREATE TABLE IF NOT EXISTS public.coletas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  executado_em timestamptz NOT NULL DEFAULT now(),
  total integer NOT NULL DEFAULT 0,
  novos integer NOT NULL DEFAULT 0,
  sucesso boolean NOT NULL DEFAULT true,
  erro text,
  duracao_ms integer
);

GRANT SELECT ON public.coletas TO authenticated;
GRANT ALL ON public.coletas TO service_role;

ALTER TABLE public.coletas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ler coletas"
  ON public.coletas FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_coletas_executado_em ON public.coletas (executado_em DESC);
