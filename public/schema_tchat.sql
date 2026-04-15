-- Tables pour le tchat communautaire

create table if not exists public.tchat_groupes (
  id          uuid default gen_random_uuid() primary key,
  nom         text not null,
  description text,
  bien_id     uuid references public.biens(id) on delete set null,
  cree_par    uuid references public.profiles(id) on delete cascade,
  created_at  timestamptz default now()
);

create table if not exists public.tchat_membres (
  id          uuid default gen_random_uuid() primary key,
  groupe_id   uuid references public.tchat_groupes(id) on delete cascade,
  user_id     uuid references public.profiles(id) on delete cascade,
  role_membre text default 'membre' check(role_membre in('admin','moderateur','membre')),
  created_at  timestamptz default now(),
  unique(groupe_id, user_id)
);

create table if not exists public.tchat_messages (
  id          uuid default gen_random_uuid() primary key,
  groupe_id   uuid references public.tchat_groupes(id) on delete cascade,
  user_id     uuid references public.profiles(id) on delete cascade,
  contenu     text not null,
  epingle     boolean default false,
  created_at  timestamptz default now()
);

-- RLS
alter table public.tchat_groupes  enable row level security;
alter table public.tchat_membres  enable row level security;
alter table public.tchat_messages enable row level security;

-- Groupes : lisibles par les membres
create policy "tchat_groupes_select" on public.tchat_groupes
  for select to authenticated
  using (
    cree_par = auth.uid() or
    id in (select groupe_id from public.tchat_membres where user_id = auth.uid())
  );
create policy "tchat_groupes_insert" on public.tchat_groupes
  for insert to authenticated with check (cree_par = auth.uid());
create policy "tchat_groupes_delete" on public.tchat_groupes
  for delete to authenticated using (cree_par = auth.uid());

-- Membres
create policy "tchat_membres_select" on public.tchat_membres
  for select to authenticated
  using (
    user_id = auth.uid() or
    groupe_id in (select id from public.tchat_groupes where cree_par = auth.uid())
  );
create policy "tchat_membres_insert" on public.tchat_membres
  for insert to authenticated
  with check (
    groupe_id in (select id from public.tchat_groupes where cree_par = auth.uid())
    or user_id = auth.uid()
  );
create policy "tchat_membres_delete" on public.tchat_membres
  for delete to authenticated
  using (
    user_id = auth.uid() or
    groupe_id in (select id from public.tchat_groupes where cree_par = auth.uid())
  );

-- Messages
create policy "tchat_messages_select" on public.tchat_messages
  for select to authenticated
  using (
    groupe_id in (select groupe_id from public.tchat_membres where user_id = auth.uid())
    or groupe_id in (select id from public.tchat_groupes where cree_par = auth.uid())
  );
create policy "tchat_messages_insert" on public.tchat_messages
  for insert to authenticated
  with check (
    user_id = auth.uid() and (
      groupe_id in (select groupe_id from public.tchat_membres where user_id = auth.uid())
      or groupe_id in (select id from public.tchat_groupes where cree_par = auth.uid())
    )
  );
create policy "tchat_messages_update" on public.tchat_messages
  for update to authenticated
  using (
    groupe_id in (select id from public.tchat_groupes where cree_par = auth.uid())
  );
create policy "tchat_messages_delete" on public.tchat_messages
  for delete to authenticated
  using (
    user_id = auth.uid() or
    groupe_id in (select id from public.tchat_groupes where cree_par = auth.uid())
  );

-- Activer Realtime
alter publication supabase_realtime add table public.tchat_messages;

select 'Schema tchat OK' as status;
