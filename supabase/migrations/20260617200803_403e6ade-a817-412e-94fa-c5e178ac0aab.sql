
ALTER TABLE public.protocolos ADD COLUMN IF NOT EXISTS hash_consulta text;
CREATE INDEX IF NOT EXISTS idx_protocolos_hash_consulta ON public.protocolos(hash_consulta);

CREATE OR REPLACE FUNCTION public.consultar_protocolo_publico(p_numero text, p_hash text)
RETURNS TABLE (
  id uuid,
  numero text,
  tipo protocolo_tipo,
  categoria protocolo_categoria,
  status protocolo_status,
  assunto text,
  descricao text,
  solicitante text,
  sigilo text,
  contato_solicitante text,
  endereco text,
  latitude double precision,
  longitude double precision,
  origem text,
  data_abertura date,
  data_prorrogacao date,
  data_conclusao date,
  prorrogado boolean,
  created_at timestamptz,
  updated_at timestamptz,
  secretaria_nome text,
  local_nome text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.numero, p.tipo, p.categoria, p.status, p.assunto, p.descricao,
         p.solicitante, p.sigilo, p.contato_solicitante, p.endereco,
         p.latitude, p.longitude, p.origem, p.data_abertura, p.data_prorrogacao,
         p.data_conclusao, p.prorrogado, p.created_at, p.updated_at,
         s.nome AS secretaria_nome,
         l.nome AS local_nome
  FROM public.protocolos p
  LEFT JOIN public.secretarias s ON s.id = p.secretaria_id
  LEFT JOIN public.locais l ON l.id = p.local_id
  WHERE upper(p.numero) = upper(p_numero)
    AND p.hash_consulta IS NOT NULL
    AND p.hash_consulta = p_hash
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.consultar_protocolo_publico(text, text) TO anon, authenticated;
