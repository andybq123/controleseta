-- 1) Responsáveis por secretaria (principal / substituto)
CREATE TABLE IF NOT EXISTS public.secretaria_responsaveis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  secretaria_id uuid NOT NULL REFERENCES public.secretarias(id) ON DELETE CASCADE,
  nome text NOT NULL,
  email text,
  telefone text,
  tipo text NOT NULL DEFAULT 'principal',
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.secretaria_responsaveis TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.secretaria_responsaveis TO authenticated;
GRANT ALL ON public.secretaria_responsaveis TO service_role;

ALTER TABLE public.secretaria_responsaveis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados leem responsaveis" ON public.secretaria_responsaveis;
CREATE POLICY "Autenticados leem responsaveis"
  ON public.secretaria_responsaveis FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins gerenciam responsaveis" ON public.secretaria_responsaveis;
CREATE POLICY "Admins gerenciam responsaveis"
  ON public.secretaria_responsaveis FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_secretaria_responsaveis_sec
  ON public.secretaria_responsaveis (secretaria_id) WHERE ativo;

DROP TRIGGER IF EXISTS trg_secretaria_responsaveis_updated_at ON public.secretaria_responsaveis;
CREATE TRIGGER trg_secretaria_responsaveis_updated_at
  BEFORE UPDATE ON public.secretaria_responsaveis
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Vínculo opcional do responsável ao protocolo (aditivo, nullable)
ALTER TABLE public.protocolos
  ADD COLUMN IF NOT EXISTS responsavel_id uuid REFERENCES public.secretaria_responsaveis(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_protocolos_responsavel ON public.protocolos (responsavel_id);

-- 3) Índices de desempenho para os filtros/buscas mais usados
CREATE INDEX IF NOT EXISTS idx_protocolos_status ON public.protocolos (status);
CREATE INDEX IF NOT EXISTS idx_protocolos_data_abertura ON public.protocolos (data_abertura DESC);
CREATE INDEX IF NOT EXISTS idx_protocolos_secretaria ON public.protocolos (secretaria_id);
CREATE INDEX IF NOT EXISTS idx_protocolos_local ON public.protocolos (local_id);
CREATE INDEX IF NOT EXISTS idx_protocolos_tipo_categoria ON public.protocolos (tipo, categoria);
CREATE INDEX IF NOT EXISTS idx_protocolos_triagem_pendente ON public.protocolos (triagem_pendente) WHERE triagem_pendente;
CREATE INDEX IF NOT EXISTS idx_protocolos_status_data ON public.protocolos (status, data_abertura DESC);
CREATE INDEX IF NOT EXISTS idx_protocolos_origem ON public.protocolos (origem);
CREATE INDEX IF NOT EXISTS idx_protocolos_data_conclusao ON public.protocolos (data_conclusao);
CREATE INDEX IF NOT EXISTS idx_protocolo_historico_protocolo ON public.protocolo_historico (protocolo_id, created_at DESC);

-- Busca textual (trigram) para número/assunto/descrição/solicitante/resolução
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_protocolos_numero_trgm ON public.protocolos USING gin (numero gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_protocolos_assunto_trgm ON public.protocolos USING gin (assunto gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_protocolos_descricao_trgm ON public.protocolos USING gin (descricao gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_protocolos_solicitante_trgm ON public.protocolos USING gin (solicitante gin_trgm_ops);
