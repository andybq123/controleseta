-- Extensões, papéis de usuário e catálogos (secretarias/locais/assuntos).

create extension if not exists pgcrypto;

create type public.app_role as enum ('admin', 'user');

create table public.secretarias (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  sigla text,
  endereco text,
  latitude double precision,
  longitude double precision,
  icone text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.locais (
  id uuid primary key default gen_random_uuid(),
  secretaria_id uuid not null references public.secretarias (id) on delete cascade,
  nome text not null,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.assuntos (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  grupo text not null,
  secretaria_id uuid references public.secretarias (id) on delete set null,
  ativo boolean not null default true,
  forcar_triagem boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create table public.allowed_emails (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  nome text,
  role public.app_role not null default 'user',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger secretarias_set_updated_at before update on public.secretarias
  for each row execute function public.update_updated_at_column();
create trigger locais_set_updated_at before update on public.locais
  for each row execute function public.update_updated_at_column();
create trigger assuntos_set_updated_at before update on public.assuntos
  for each row execute function public.update_updated_at_column();
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.update_updated_at_column();

-- has_role() é usado em quase toda policy de RLS deste projeto.
create function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;

-- Login é allowlist-based: só quem está em allowed_emails vira usuário do
-- sistema. Trigger roda com o privilégio do dono (auth admin) porque
-- auth.users não é gravável por roles comuns.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_allowed public.allowed_emails%rowtype;
begin
  select * into v_allowed from public.allowed_emails where email = new.email;
  if not found then
    raise exception 'E-mail % não autorizado a acessar o sistema.', new.email;
  end if;

  insert into public.profiles (id, nome, email)
  values (new.id, coalesce(v_allowed.nome, new.raw_user_meta_data ->> 'full_name'), new.email);

  insert into public.user_roles (user_id, role)
  values (new.id, v_allowed.role);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
