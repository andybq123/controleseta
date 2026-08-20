-- Fila de triagem: RPCs com lock otimista (10 min) para evitar que dois
-- atendentes triem o mesmo protocolo, e os triggers que mantêm o estado de
-- triagem consistente.

-- Reserva um item para o usuário atual. SECURITY DEFINER porque a RLS de
-- protocolos só permite UPDATE a quem já é admin — a checagem de papel é
-- feita explicitamente aqui dentro, então o bypass de RLS é seguro.
create function public.reservar_triagem(p_protocolo_id uuid)
returns public.protocolos
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.protocolos;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Sem permissão para triar protocolos.';
  end if;

  update public.protocolos
  set triagem_lock_por = auth.uid(), triagem_lock_em = now()
  where id = p_protocolo_id
    and triagem_pendente = true
    and (
      triagem_lock_por is null
      or triagem_lock_por = auth.uid()
      or triagem_lock_em < now() - interval '10 minutes'
    )
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Este item já está em triagem por outro usuário.';
  end if;

  return v_row;
end;
$$;

create function public.liberar_triagem(p_protocolo_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Sem permissão para triar protocolos.';
  end if;

  update public.protocolos
  set triagem_lock_por = null, triagem_lock_em = null
  where id = p_protocolo_id and triagem_lock_por = auth.uid();
end;
$$;

create function public.concluir_triagem(
  p_protocolo_id uuid,
  p_secretaria_id uuid,
  p_local_id uuid default null
)
returns public.protocolos
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.protocolos;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Sem permissão para triar protocolos.';
  end if;

  update public.protocolos
  set secretaria_id = p_secretaria_id,
      local_id = p_local_id,
      triagem_pendente = false,
      triagem_lock_por = null,
      triagem_lock_em = null
  where id = p_protocolo_id and triagem_lock_por = auth.uid()
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Você não está com o lock de triagem deste item (pode ter expirado).';
  end if;

  return v_row;
end;
$$;

revoke execute on function public.reservar_triagem(uuid) from public, anon;
revoke execute on function public.liberar_triagem(uuid) from public, anon;
revoke execute on function public.concluir_triagem(uuid, uuid, uuid) from public, anon;
grant execute on function public.reservar_triagem(uuid) to authenticated;
grant execute on function public.liberar_triagem(uuid) to authenticated;
grant execute on function public.concluir_triagem(uuid, uuid, uuid) to authenticated;

-- Carimba quem/quando encerrou a triagem (roda dentro do UPDATE feito por
-- concluir_triagem, que ainda preserva auth.uid() do chamador original).
create function public.stamp_triagem_conclusao()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.triagem_pendente = true and new.triagem_pendente = false then
    new.triagem_concluida_em := now();
    new.triagem_concluida_por := auth.uid();
  end if;
  return new;
end;
$$;

create trigger protocolos_stamp_triagem
  before update on public.protocolos
  for each row execute function public.stamp_triagem_conclusao();

-- Protocolos criados por processo automático (sem created_by — ex.: sync de
-- e-mail) do tipo ouvidoria entram em triagem obrigatória quando não há
-- secretaria mapeada, o assunto é de Saúde, ou o assunto está marcado
-- forcar_triagem no catálogo.
create function public.force_triagem_para_ouvidoria()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.created_by is null and new.tipo = 'ouvidoria' then
    if new.secretaria_id is null
      or exists (
        select 1 from public.assuntos
        where nome = new.assunto and (forcar_triagem or grupo = 'Saúde')
      )
    then
      new.triagem_pendente := true;
    end if;
  end if;
  return new;
end;
$$;

create trigger protocolos_force_triagem
  before insert on public.protocolos
  for each row execute function public.force_triagem_para_ouvidoria();
