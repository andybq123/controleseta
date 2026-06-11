UPDATE public.protocolos p
SET descricao = concat(
  'Nova Ouvidoria recebida.', E'\n\n',
  'Nº: ', p.numero, E'\n',
  'Assunto: ', COALESCE(p.assunto, ''), E'\n',
  'De: ', COALESCE(NULLIF(p.solicitante, ''), '-'), E'\n',
  'Para: ', COALESCE((SELECT s.nome FROM public.secretarias s WHERE s.id = p.secretaria_id), '')
);