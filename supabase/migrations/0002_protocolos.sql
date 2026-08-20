-- Tabela central: protocolos (manifestações de ouvidoria/LAI/e-SIC) + auditoria.

create type public.protocolo_tipo as enum ('ouvidoria', 'lai', 'esic');

create type public.protocolo_categoria as enum (
  'elogio', 'reclamacao', 'pedido_informacao', 'denuncia', 'solicitacao', 'outros', 'sugestao'
);

create type public.protocolo_status as enum ('aberto', 'em_andamento', 'concluido');

create table public.protocolos (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique,
  tipo public.protocolo_tipo not null default 'ouvidoria',
  categoria public.protocolo_categoria not null,
  status public.protocolo_status not null default 'em_andamento',
  assunto text not null,
  descricao text not null,
  secretaria_id uuid references public.secretarias (id) on delete set null,
  local_id uuid references public.locais (id) on delete set null,
  solicitante text,
  contato_solicitante text,
  sigilo text not null default 'publico' check (sigilo in ('publico', 'sigiloso', 'anonimo')),
  origem text,
  endereco text,
  latitude double precision,
  longitude double precision,
  url text,
  detalhes jsonb,
  hash_consulta text,
  data_abertura date not null default current_date,
  data_prorrogacao date,
  data_conclusao date,
  prorrogado boolean not null default false,
  -- Triagem: fila de itens sem secretaria/descrição definitivas, com lock
  -- otimista para evitar que dois atendentes triem o mesmo item.
  triagem_pendente boolean not null default false,
  triagem_lock_por uuid references auth.users (id) on delete set null,
  triagem_lock_em timestamptz,
  triagem_concluida_em timestamptz,
  triagem_concluida_por uuid references public.profiles (id) on delete set null,
  -- Situação/notas editáveis manualmente para protocolos importados de
  -- sistemas legados (substitui o hack de overrides em localStorage).
  situacao_manual text,
  notas_manual text,
  coletado_em timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.protocolos.situacao_manual is
  'Override manual de situação (ex.: para protocolos importados de sistema legado), independente do status/prazo calculado.';

create trigger protocolos_set_updated_at before update on public.protocolos
  for each row execute function public.update_updated_at_column();

create index protocolos_status_idx on public.protocolos (status);
create index protocolos_tipo_idx on public.protocolos (tipo);
create index protocolos_categoria_idx on public.protocolos (categoria);
create index protocolos_data_abertura_idx on public.protocolos (data_abertura);
create index protocolos_secretaria_id_idx on public.protocolos (secretaria_id);
create index protocolos_triagem_pendente_idx on public.protocolos (triagem_pendente) where triagem_pendente;
create index protocolos_hash_consulta_idx on public.protocolos (hash_consulta) where hash_consulta is not null;
-- Segunda defesa contra colisão de número em ingestão concorrente: unicidade
-- também sobre o número normalizado (sem separadores).
create unique index protocolos_numero_normalizado_idx
  on public.protocolos (regexp_replace(numero, '[^0-9]', '', 'g'));

alter table public.protocolos replica identity full;
alter publication supabase_realtime add table public.protocolos;

create table public.protocolo_historico (
  id uuid primary key default gen_random_uuid(),
  protocolo_id uuid not null references public.protocolos (id) on delete cascade,
  campo text not null,
  valor_anterior text,
  valor_novo text,
  acao text not null check (acao in ('create', 'update')),
  autor_id uuid references auth.users (id) on delete set null,
  autor_nome text,
  created_at timestamptz not null default now()
);

create index protocolo_historico_protocolo_id_idx on public.protocolo_historico (protocolo_id);

-- Grava um diff campo a campo em protocolo_historico a cada INSERT/UPDATE em
-- protocolos. SECURITY DEFINER porque a policy de RLS de protocolo_historico
-- não concede INSERT direto a authenticated (só é escrito por este trigger).
create function public.log_protocolo_changes()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_autor_nome text;
  v_campo text;
  v_old text;
  v_new text;
begin
  select nome into v_autor_nome from public.profiles where id = auth.uid();

  if tg_op = 'INSERT' then
    insert into public.protocolo_historico (protocolo_id, campo, valor_novo, acao, autor_id, autor_nome)
    values (new.id, 'protocolo', 'criado', 'create', auth.uid(), v_autor_nome);
    return new;
  end if;

  for v_campo, v_old, v_new in
    select key, old_val, new_val
    from jsonb_each_text(to_jsonb(old)) as o (key, old_val)
    join jsonb_each_text(to_jsonb(new)) as n (key, new_val) using (key)
    where o.old_val is distinct from n.new_val
      and o.key not in ('updated_at', 'triagem_lock_por', 'triagem_lock_em')
  loop
    insert into public.protocolo_historico (protocolo_id, campo, valor_anterior, valor_novo, acao, autor_id, autor_nome)
    values (new.id, v_campo, v_old, v_new, 'update', auth.uid(), v_autor_nome);
  end loop;

  return new;
end;
$$;

create trigger protocolos_log_changes
  after insert or update on public.protocolos
  for each row execute function public.log_protocolo_changes();
