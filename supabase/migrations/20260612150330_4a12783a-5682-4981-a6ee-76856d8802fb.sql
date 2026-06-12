
-- Normaliza números de protocolo importados da planilha de Saúde (junho/2026)
-- para o formato pt-BR "1.832/2026" e remove duplicatas vs registros existentes.

-- 1) Apaga os recém-inseridos cujo número (formatado) já existe
DELETE FROM public.protocolos p
WHERE p.secretaria_id = '8ee7bf01-4cde-494c-8e99-92d3ccabb0f5'
  AND p.data_abertura >= '2026-06-01' AND p.data_abertura < '2026-07-01'
  AND p.numero ~ '^[0-9]+/2026$'
  AND EXISTS (
    SELECT 1 FROM public.protocolos x
    WHERE x.numero = regexp_replace(p.numero, '^([0-9])([0-9]{3})/', '\1.\2/')
  );

-- 2) Renomeia os restantes para o formato com ponto de milhar
UPDATE public.protocolos
SET numero = regexp_replace(numero, '^([0-9])([0-9]{3})/', '\1.\2/')
WHERE secretaria_id = '8ee7bf01-4cde-494c-8e99-92d3ccabb0f5'
  AND data_abertura >= '2026-06-01' AND data_abertura < '2026-07-01'
  AND numero ~ '^[0-9]{4}/2026$';
