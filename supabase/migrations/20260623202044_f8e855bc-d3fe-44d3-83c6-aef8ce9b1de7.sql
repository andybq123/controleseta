-- Índice único funcional para evitar duplicidade de protocolos cujo número
-- é o mesmo apenas variando os separadores de milhar (ex: "2.078/2026" e
-- "2078/2026"). Funciona como segunda linha de defesa contra race conditions
-- na ingestão paralela de e-mails.
CREATE UNIQUE INDEX IF NOT EXISTS protocolos_numero_normalizado_key
  ON public.protocolos ((regexp_replace(numero, '[^0-9/]', '', 'g')));