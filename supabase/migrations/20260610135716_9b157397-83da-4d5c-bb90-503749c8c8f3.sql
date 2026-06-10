
-- Categoria enum
CREATE TYPE public.protocolo_categoria AS ENUM ('elogio','reclamacao','pedido_informacao','denuncia','solicitacao','outros');

ALTER TABLE public.protocolos
  ADD COLUMN categoria public.protocolo_categoria NOT NULL DEFAULT 'solicitacao';

ALTER TABLE public.secretarias
  ADD COLUMN centro_custo TEXT;

CREATE TABLE public.locais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  secretaria_id UUID NOT NULL REFERENCES public.secretarias(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  centro_custo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.locais TO authenticated;
GRANT ALL ON public.locais TO service_role;

ALTER TABLE public.locais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados gerenciam locais" ON public.locais
  FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE TRIGGER update_locais_updated_at BEFORE UPDATE ON public.locais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.protocolos
  ADD COLUMN local_id UUID REFERENCES public.locais(id) ON DELETE SET NULL;

CREATE INDEX idx_locais_secretaria ON public.locais(secretaria_id);
CREATE INDEX idx_protocolos_local ON public.protocolos(local_id);
CREATE INDEX idx_protocolos_categoria ON public.protocolos(categoria);
CREATE INDEX idx_protocolos_data_abertura ON public.protocolos(data_abertura);
