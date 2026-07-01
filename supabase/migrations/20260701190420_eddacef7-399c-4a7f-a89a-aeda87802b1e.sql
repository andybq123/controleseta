
-- Índice para separar rapidamente protocolos legados dos atuais
CREATE INDEX IF NOT EXISTS idx_protocolos_origem_antigo
  ON public.protocolos (data_abertura DESC)
  WHERE origem LIKE 'antigo:%';

CREATE INDEX IF NOT EXISTS idx_protocolos_nao_antigos
  ON public.protocolos (data_abertura DESC)
  WHERE origem IS NULL OR origem NOT LIKE 'antigo:%';

-- Índice composto para o filtro principal (triagem_pendente=false ordenado por data)
CREATE INDEX IF NOT EXISTS idx_protocolos_lista_principal
  ON public.protocolos (triagem_pendente, data_abertura DESC);

ANALYZE public.protocolos;
