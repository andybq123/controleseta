CREATE TABLE public.protocolos_antigos_conclusoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL,
  numero INTEGER NOT NULL,
  ano INTEGER NOT NULL,
  url TEXT,
  data_conclusao DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(source, numero, ano)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.protocolos_antigos_conclusoes TO authenticated;
GRANT ALL ON public.protocolos_antigos_conclusoes TO service_role;
ALTER TABLE public.protocolos_antigos_conclusoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados leem conclusoes antigos" ON public.protocolos_antigos_conclusoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados gerenciam conclusoes antigos" ON public.protocolos_antigos_conclusoes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_protocolos_antigos_conclusoes_updated_at BEFORE UPDATE ON public.protocolos_antigos_conclusoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();