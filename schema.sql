-- ═══════════════════════════════════════════════════════════
-- IMMOTRACK v2 — Schema Supabase complet
-- Supabase → SQL Editor → Run tout
-- ═══════════════════════════════════════════════════════════

-- ── TRIGGER profil auto ──────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_role text;
begin
  v_role := lower(trim(coalesce(new.raw_user_meta_data->>'role','locataire')));
  if v_role not in ('locataire','proprietaire','gestionnaire','prestataire') then v_role := 'locataire'; end if;
  insert into public.profiles(id, role, nom, prenom)
  values(new.id, v_role, coalesce(new.raw_user_meta_data->>'nom','Utilisateur'), coalesce(new.raw_user_meta_data->>'prenom','Nouveau'))
  on conflict(id) do nothing;
  return new;
end;$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- ── TABLES ──────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  role text not null default 'locataire' check(role in('locataire','proprietaire','gestionnaire','prestataire')),
  nom text, prenom text, telephone text, telephone2 text,
  nom_societe text, adresse text, code_postal text, ville text, notes text,
  created_at timestamptz default now()
);

create table if not exists public.biens (
  id uuid default gen_random_uuid() primary key,
  proprietaire_id uuid references public.profiles(id) on delete cascade not null,
  adresse text not null, ville text not null, code_postal text,
  type_bien text, surface_m2 numeric, description text,
  created_at timestamptz default now()
);

create table if not exists public.locations (
  id uuid default gen_random_uuid() primary key,
  bien_id uuid references public.biens(id) on delete cascade not null,
  locataire_id uuid references public.profiles(id) on delete set null,
  loyer_mensuel numeric not null, charges numeric default 0,
  depot_garantie numeric, date_debut date not null, date_fin date,
  statut text default 'actif' check(statut in('actif','termine','suspendu')),
  type_contrat text, created_at timestamptz default now()
);

create table if not exists public.occupants (
  id uuid default gen_random_uuid() primary key,
  location_id uuid references public.locations(id) on delete cascade,
  nom text not null, prenom text not null,
  date_naissance date, lien text default 'autre',
  created_at timestamptz default now()
);

create table if not exists public.garants (
  id uuid default gen_random_uuid() primary key,
  location_id uuid references public.locations(id) on delete cascade,
  nom text not null, prenom text not null, telephone text, email text,
  adresse text, lien text, type_caution text default 'physique',
  montant numeric, date_debut date, notes text,
  created_at timestamptz default now()
);

create table if not exists public.invitations (
  id uuid default gen_random_uuid() primary key,
  email text not null, role text default 'locataire',
  nom text, prenom text, telephone text,
  bien_id uuid references public.biens(id) on delete set null,
  loyer numeric, date_debut date, type_contrat text,
  statut text default 'en_attente', cree_par uuid references public.profiles(id),
  expire_le timestamptz default(now() + interval '30 days'),
  created_at timestamptz default now()
);

create table if not exists public.incidents (
  id uuid default gen_random_uuid() primary key,
  bien_id uuid references public.biens(id) on delete cascade not null,
  signale_par uuid references public.profiles(id) on delete set null,
  titre text not null, description text,
  gravite text default 'moyen' check(gravite in('faible','moyen','urgent')),
  statut text default 'nouveau' check(statut in('nouveau','en_cours','en_attente','resolu','annule')),
  equipement_id uuid, created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.medias (
  id uuid default gen_random_uuid() primary key,
  incident_id uuid references public.incidents(id) on delete cascade,
  uploaded_by uuid references public.profiles(id),
  url text not null, type text, nom text,
  created_at timestamptz default now()
);

create table if not exists public.documents (
  id uuid default gen_random_uuid() primary key,
  bien_id uuid references public.biens(id) on delete cascade,
  uploaded_by uuid references public.profiles(id),
  nom text not null, type text, url text not null,
  favori boolean default false, partage_token uuid,
  created_at timestamptz default now()
);

create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  expediteur uuid references public.profiles(id),
  destinataire uuid references public.profiles(id),
  contenu text not null, lu boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.prestataires (
  id uuid default gen_random_uuid() primary key,
  nom text not null, prenom text, societe text, telephone text, email text,
  specialite text, note numeric, adresse text, notes text,
  created_at timestamptz default now()
);

-- ── CATALOGUE ──────────────────────────────────────────
create table if not exists public.catalogue_zones (
  id uuid default gen_random_uuid() primary key, nom text not null unique, icone text, ordre int default 0
);
create table if not exists public.catalogue_pieces (
  id uuid default gen_random_uuid() primary key,
  zone_id uuid references public.catalogue_zones(id) on delete cascade,
  nom text not null, icone text, ordre int default 0
);
create table if not exists public.catalogue_equipements (
  id uuid default gen_random_uuid() primary key,
  piece_id uuid references public.catalogue_pieces(id) on delete cascade,
  nom text not null, icone text, type text, ordre int default 0
);
create table if not exists public.catalogue_pannes (
  id uuid default gen_random_uuid() primary key,
  equipement_id uuid references public.catalogue_equipements(id) on delete cascade,
  description text not null, gravite_defaut text default 'moyen', ordre int default 0
);

-- ── PLAN ──────────────────────────────────────────────
create table if not exists public.plan_pieces (
  id uuid default gen_random_uuid() primary key,
  bien_id uuid references public.biens(id) on delete cascade not null,
  nom text not null, icone text default '🏠', couleur text default '#E8F2EB',
  x int default 0, y int default 0, w int default 2, h int default 2, etage int default 0,
  created_at timestamptz default now()
);
create table if not exists public.plan_equipements (
  id uuid default gen_random_uuid() primary key,
  bien_id uuid references public.biens(id) on delete cascade not null,
  plan_piece_id uuid references public.plan_pieces(id) on delete set null,
  nom text not null, icone text default '🔧', categorie text default 'autre',
  couleur text default '#EBF2FC', notes text,
  grid_x int default 20, grid_y int default 20, etage int default 0,
  created_at timestamptz default now()
);

-- ── FONCTIONS ANTI-RÉCURSION RLS ──────────────────────
create or replace function public.get_biens_owner(uid uuid)
returns setof uuid language sql security definer stable as $$
  select id from public.biens where proprietaire_id = uid;
$$;
create or replace function public.get_biens_locataire(uid uuid)
returns setof uuid language sql security definer stable as $$
  select bien_id from public.locations where locataire_id = uid and statut='actif';
$$;

-- ── RLS ───────────────────────────────────────────────
alter table public.profiles         enable row level security;
alter table public.biens             enable row level security;
alter table public.locations         enable row level security;
alter table public.occupants         enable row level security;
alter table public.garants           enable row level security;
alter table public.invitations       enable row level security;
alter table public.incidents         enable row level security;
alter table public.medias            enable row level security;
alter table public.documents         enable row level security;
alter table public.messages          enable row level security;
alter table public.prestataires      enable row level security;
alter table public.catalogue_zones   enable row level security;
alter table public.catalogue_pieces  enable row level security;
alter table public.catalogue_equipements enable row level security;
alter table public.catalogue_pannes  enable row level security;
alter table public.plan_pieces       enable row level security;
alter table public.plan_equipements  enable row level security;

-- profiles
create policy "profile_own" on public.profiles for all to authenticated using(auth.uid()=id) with check(auth.uid()=id);

-- biens
create policy "biens_owner"    on public.biens for all    to authenticated using(proprietaire_id=auth.uid()) with check(proprietaire_id=auth.uid());
create policy "biens_locataire"on public.biens for select to authenticated using(id in(select public.get_biens_locataire(auth.uid())));

-- locations
create policy "loc_owner"    on public.locations for all    to authenticated using(bien_id in(select public.get_biens_owner(auth.uid()))) with check(bien_id in(select public.get_biens_owner(auth.uid())));
create policy "loc_locataire"on public.locations for select to authenticated using(locataire_id=auth.uid());

-- occupants/garants
create policy "occ_owner" on public.occupants for all to authenticated using(location_id in(select l.id from locations l join biens b on b.id=l.bien_id where b.proprietaire_id=auth.uid()));
create policy "gar_owner" on public.garants   for all to authenticated using(location_id in(select l.id from locations l join biens b on b.id=l.bien_id where b.proprietaire_id=auth.uid()));

-- invitations
create policy "inv_owner" on public.invitations for all to authenticated using(cree_par=auth.uid()) with check(cree_par=auth.uid());

-- incidents
create policy "inc_owner"    on public.incidents for all    to authenticated using(bien_id in(select public.get_biens_owner(auth.uid())));
create policy "inc_signaler" on public.incidents for insert to authenticated with check(signale_par=auth.uid());
create policy "inc_locataire"on public.incidents for select to authenticated using(signale_par=auth.uid());
create policy "inc_loc_upd"  on public.incidents for update to authenticated using(signale_par=auth.uid());

-- medias / documents
create policy "medias_read"  on public.medias for select to authenticated using(true);
create policy "medias_write" on public.medias for insert to authenticated with check(uploaded_by=auth.uid());
create policy "docs_read"    on public.documents for select to authenticated using(bien_id in(select public.get_biens_owner(auth.uid())) or bien_id in(select public.get_biens_locataire(auth.uid())));
create policy "docs_write"   on public.documents for all to authenticated using(uploaded_by=auth.uid()) with check(uploaded_by=auth.uid());

-- messages
create policy "msg_read"   on public.messages for select to authenticated using(expediteur=auth.uid() or destinataire=auth.uid());
create policy "msg_send"   on public.messages for insert to authenticated with check(expediteur=auth.uid());
create policy "msg_read_upd" on public.messages for update to authenticated using(destinataire=auth.uid());

-- prestataires / catalogue
create policy "prest_read"  on public.prestataires         for select to authenticated using(true);
create policy "prest_write" on public.prestataires         for all    to authenticated using(auth.uid() in(select id from profiles where role in('proprietaire','gestionnaire')));
create policy "cat_read"    on public.catalogue_zones      for select to authenticated using(true);
create policy "cat_read"    on public.catalogue_pieces     for select to authenticated using(true);
create policy "cat_read"    on public.catalogue_equipements for select to authenticated using(true);
create policy "cat_read"    on public.catalogue_pannes     for select to authenticated using(true);
create policy "cat_write"   on public.catalogue_zones      for all    to authenticated using(auth.uid() in(select id from profiles where role in('proprietaire','gestionnaire')));
create policy "cat_wpieces" on public.catalogue_pieces     for all    to authenticated using(auth.uid() in(select id from profiles where role in('proprietaire','gestionnaire')));
create policy "cat_wequips" on public.catalogue_equipements for all   to authenticated using(auth.uid() in(select id from profiles where role in('proprietaire','gestionnaire')));
create policy "cat_wpannes" on public.catalogue_pannes     for all    to authenticated using(auth.uid() in(select id from profiles where role in('proprietaire','gestionnaire')));

-- plan
create policy "plan_p_owner"    on public.plan_pieces      for all    to authenticated using(bien_id in(select public.get_biens_owner(auth.uid()))) with check(bien_id in(select public.get_biens_owner(auth.uid())));
create policy "plan_p_loc"      on public.plan_pieces      for select to authenticated using(bien_id in(select public.get_biens_locataire(auth.uid())));
create policy "plan_e_owner"    on public.plan_equipements for all    to authenticated using(bien_id in(select public.get_biens_owner(auth.uid()))) with check(bien_id in(select public.get_biens_owner(auth.uid())));
create policy "plan_e_loc"      on public.plan_equipements for select to authenticated using(bien_id in(select public.get_biens_locataire(auth.uid())));

select 'Schema ImmoTrack v2 OK' as status;
