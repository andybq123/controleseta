
-- 1) Garante um "local" homônimo para cada secretaria que tenha protocolos sem local
INSERT INTO public.locais (nome, secretaria_id)
SELECT s.nome, s.id
FROM public.secretarias s
WHERE EXISTS (
  SELECT 1 FROM public.protocolos p
  WHERE p.secretaria_id = s.id AND p.local_id IS NULL
)
AND NOT EXISTS (
  SELECT 1 FROM public.locais l
  WHERE l.secretaria_id = s.id AND lower(l.nome) = lower(s.nome)
);

-- 2) Garante um "responsável" homônimo para cada secretaria que tenha protocolos sem responsável
INSERT INTO public.responsaveis (nome, secretaria_id)
SELECT s.nome, s.id
FROM public.secretarias s
WHERE EXISTS (
  SELECT 1 FROM public.protocolos p
  WHERE p.secretaria_id = s.id AND p.responsavel_id IS NULL
)
AND NOT EXISTS (
  SELECT 1 FROM public.responsaveis r
  WHERE r.secretaria_id = s.id AND lower(r.nome) = lower(s.nome)
);

-- 3) Associa os protocolos sem local ao local homônimo da sua secretaria
UPDATE public.protocolos p
SET local_id = l.id
FROM public.locais l
WHERE p.local_id IS NULL
  AND p.secretaria_id IS NOT NULL
  AND l.secretaria_id = p.secretaria_id
  AND lower(l.nome) = lower((SELECT s.nome FROM public.secretarias s WHERE s.id = p.secretaria_id));

-- 4) Associa os protocolos sem responsável ao responsável homônimo da sua secretaria
UPDATE public.protocolos p
SET responsavel_id = r.id
FROM public.responsaveis r
WHERE p.responsavel_id IS NULL
  AND p.secretaria_id IS NOT NULL
  AND r.secretaria_id = p.secretaria_id
  AND lower(r.nome) = lower((SELECT s.nome FROM public.secretarias s WHERE s.id = p.secretaria_id));
