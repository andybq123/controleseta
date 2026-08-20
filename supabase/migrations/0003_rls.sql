-- RLS: leitura pública restrita a sigilo='publico', escrita restrita a
-- admin, exceto o INSERT em protocolos (form público de ouvidoria, aberto a
-- anon) e SELECT em secretarias/locais/assuntos (dropdowns do form público).

alter table public.secretarias enable row level security;
alter table public.locais enable row level security;
alter table public.assuntos enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.allowed_emails enable row level security;
alter table public.protocolos enable row level security;
alter table public.protocolo_historico enable row level security;

-- secretarias / locais / assuntos: leitura aberta (form público e telas
-- internas usam os mesmos dropdowns), escrita só admin.
create policy secretarias_select_all on public.secretarias
  for select to anon, authenticated using (true);
create policy secretarias_write_admin on public.secretarias
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy locais_select_all on public.locais
  for select to anon, authenticated using (true);
create policy locais_write_admin on public.locais
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy assuntos_select_all on public.assuntos
  for select to anon, authenticated using (true);
create policy assuntos_write_admin on public.assuntos
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- profiles: cada usuário vê/edita o próprio; admin vê todos.
create policy profiles_select_own_or_admin on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- user_roles / allowed_emails: administração de acesso, só admin.
create policy user_roles_select_own_or_admin on public.user_roles
  for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy user_roles_write_admin on public.user_roles
  for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy user_roles_update_admin on public.user_roles
  for update to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy user_roles_delete_admin on public.user_roles
  for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

create policy allowed_emails_all_admin on public.allowed_emails
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- protocolos: leitura filtra sigilo (só admin vê sigiloso/anônimo);
-- inserção aberta a anon+authenticated (form público); demais operações
-- restritas a admin.
create policy protocolos_select on public.protocolos
  for select to authenticated
  using (sigilo = 'publico' or public.has_role(auth.uid(), 'admin'));
create policy protocolos_insert_public on public.protocolos
  for insert to anon, authenticated with check (true);
create policy protocolos_update_admin on public.protocolos
  for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
create policy protocolos_delete_admin on public.protocolos
  for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

-- protocolo_historico: só leitura, só admin (é escrito exclusivamente pelo
-- trigger log_protocolo_changes, que é SECURITY DEFINER).
create policy protocolo_historico_select_admin on public.protocolo_historico
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));
