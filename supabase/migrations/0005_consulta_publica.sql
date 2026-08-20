-- Consulta pública de protocolo por número + hash, sem exigir login.
-- SECURITY DEFINER porque protocolos sigilosos/anônimos não são legíveis por
-- anon via RLS direta — aqui o "segredo compartilhado" (hash) é a própria
-- autorização, checada explicitamente antes de retornar qualquer coisa.

create function public.consultar_protocolo_publico(p_numero text, p_hash text)
returns table (
  numero text,
  tipo public.protocolo_tipo,
  categoria public.protocolo_categoria,
  status public.protocolo_status,
  assunto text,
  descricao text,
  secretaria text,
  local text,
  data_abertura date,
  data_conclusao date,
  origem text
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
      p.numero, p.tipo, p.categoria, p.status, p.assunto, p.descricao,
      s.nome, l.nome, p.data_abertura, p.data_conclusao, p.origem
    from public.protocolos p
    left join public.secretarias s on s.id = p.secretaria_id
    left join public.locais l on l.id = p.local_id
    where p.numero = p_numero and p.hash_consulta = p_hash;
end;
$$;

revoke execute on function public.consultar_protocolo_publico(text, text) from public;
grant execute on function public.consultar_protocolo_publico(text, text) to anon, authenticated;
