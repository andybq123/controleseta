-- Consulta pública de protocolo por número + hash, sem exigir login.
-- SECURITY DEFINER porque protocolos sigilosos/anônimos não são legíveis por
-- anon via RLS direta — aqui o "segredo compartilhado" (hash) é a própria
-- autorização, checada explicitamente antes de retornar qualquer coisa.

create function public.consultar_protocolo_publico(p_numero text, p_hash text)
returns table (
  id uuid,
  numero text,
  tipo public.protocolo_tipo,
  categoria public.protocolo_categoria,
  status public.protocolo_status,
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
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if p_numero is null or p_hash is null or length(p_hash) = 0 then
    return;
  end if;

  return query
    select
      p.id, p.numero, p.tipo, p.categoria, p.status, p.assunto, p.descricao,
      p.solicitante, p.sigilo, p.contato_solicitante, p.endereco, p.latitude, p.longitude,
      p.origem, p.data_abertura, p.data_prorrogacao, p.data_conclusao, p.prorrogado,
      p.created_at, p.updated_at, s.nome, l.nome
    from public.protocolos p
    left join public.secretarias s on s.id = p.secretaria_id
    left join public.locais l on l.id = p.local_id
    where p.numero = p_numero and p.hash_consulta = p_hash;
end;
$$;

revoke execute on function public.consultar_protocolo_publico(text, text) from public;
grant execute on function public.consultar_protocolo_publico(text, text) to anon, authenticated;
