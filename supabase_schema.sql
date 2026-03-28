-- ============================================================
-- IMMOTRACK — Schéma Supabase
-- À exécuter dans : Supabase Dashboard > SQL Editor
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";

-- ── PROFILS UTILISATEURS ─────────────────────────────────
-- Complète la table auth.users de Supabase
create table public.profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  role        text not null check (role in ('locataire','proprietaire','gestionnaire','prestataire')),
  nom         text not null,
  prenom      text not null,
  telephone   text,
  avatar_url  text,
  created_at  timestamptz default now()
);

-- ── BIENS IMMOBILIERS ────────────────────────────────────
create table public.biens (
  id             uuid default uuid_generate_v4() primary key,
  proprietaire_id uuid references public.profiles(id) on delete cascade not null,
  adresse        text not null,
  ville          text not null,
  code_postal    text not null,
  type_bien      text not null, -- 'appartement','maison','studio'
  surface_m2     numeric,
  created_at     timestamptz default now()
);

-- ── LOCATIONS (bail en cours) ─────────────────────────────
create table public.locations (
  id            uuid default uuid_generate_v4() primary key,
  bien_id       uuid references public.biens(id) on delete cascade not null,
  locataire_id  uuid references public.profiles(id) on delete set null,
  loyer_mensuel numeric not null,
  date_debut    date not null,
  date_fin      date,
  statut        text default 'actif' check (statut in ('actif','termine','resilié')),
  created_at    timestamptz default now()
);

-- ── PIÈCES ───────────────────────────────────────────────
create table public.pieces (
  id       uuid default uuid_generate_v4() primary key,
  bien_id  uuid references public.biens(id) on delete cascade not null,
  nom      text not null,  -- 'Cuisine', 'Salon', 'Chambre 1'...
  ordre    int default 0
);

-- ── ÉLÉMENTS (dans une pièce) ────────────────────────────
create table public.elements (
  id       uuid default uuid_generate_v4() primary key,
  piece_id uuid references public.pieces(id) on delete cascade not null,
  nom      text not null,  -- 'Robinet évier', 'Volet électrique'...
  type     text            -- 'plomberie','electrique','menuiserie'...
);

-- ── INCIDENTS ────────────────────────────────────────────
create table public.incidents (
  id            uuid default uuid_generate_v4() primary key,
  bien_id       uuid references public.biens(id) on delete cascade not null,
  piece_id      uuid references public.pieces(id) on delete set null,
  element_id    uuid references public.elements(id) on delete set null,
  signale_par   uuid references public.profiles(id) on delete set null not null,
  assigned_to   uuid references public.profiles(id) on delete set null,
  titre         text not null,
  description   text,
  categorie     text not null, -- 'plomberie','electricite','chauffage'...
  gravite       text not null check (gravite in ('faible','moyen','urgent')),
  statut        text not null default 'nouveau'
                  check (statut in ('nouveau','en_cours','resolu','annule')),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ── MÉDIAS ───────────────────────────────────────────────
create table public.medias (
  id           uuid default uuid_generate_v4() primary key,
  incident_id  uuid references public.incidents(id) on delete cascade not null,
  element_id   uuid references public.elements(id) on delete set null,
  uploaded_by  uuid references public.profiles(id) on delete set null not null,
  type         text not null check (type in ('photo','video','audio','document')),
  url          text not null,   -- URL Supabase Storage
  nom_fichier  text,
  taille_bytes bigint,
  commentaire  text,
  exif_data    jsonb,           -- métadonnées EXIF
  created_at   timestamptz default now()
);

-- ── DOCUMENTS ────────────────────────────────────────────
create table public.documents (
  id           uuid default uuid_generate_v4() primary key,
  bien_id      uuid references public.biens(id) on delete cascade,
  location_id  uuid references public.locations(id) on delete cascade,
  uploaded_by  uuid references public.profiles(id) on delete set null not null,
  categorie    text not null, -- 'bail','etat_des_lieux','quittance','assurance','autre'
  nom          text not null,
  url          text not null,
  taille_bytes bigint,
  est_favori   boolean default false,
  partage_token text,          -- token lien temporaire
  partage_expire timestamptz,
  created_at   timestamptz default now()
);

-- ── MESSAGES ─────────────────────────────────────────────
create table public.messages (
  id           uuid default uuid_generate_v4() primary key,
  incident_id  uuid references public.incidents(id) on delete cascade,
  expediteur   uuid references public.profiles(id) on delete set null not null,
  destinataire uuid references public.profiles(id) on delete set null not null,
  contenu      text not null,
  lu           boolean default false,
  created_at   timestamptz default now()
);

-- ── PRESTATAIRES ─────────────────────────────────────────
create table public.prestataires (
  id            uuid default uuid_generate_v4() primary key,
  profile_id    uuid references public.profiles(id) on delete cascade,
  nom_entreprise text not null,
  specialite    text not null,
  telephone     text,
  email         text,
  note_moyenne  numeric default 0,
  nb_missions   int default 0,
  created_at    timestamptz default now()
);

-- ── AUDIT LOG ────────────────────────────────────────────
create table public.audit_log (
  id          uuid default uuid_generate_v4() primary key,
  table_name  text not null,
  record_id   uuid not null,
  action      text not null, -- 'create','update','delete','view'
  user_id     uuid references public.profiles(id) on delete set null,
  details     jsonb,
  created_at  timestamptz default now()
);

-- ============================================================
-- SÉCURITÉ — Row Level Security (RLS)
-- ============================================================

alter table public.profiles    enable row level security;
alter table public.biens       enable row level security;
alter table public.locations   enable row level security;
alter table public.pieces      enable row level security;
alter table public.elements    enable row level security;
alter table public.incidents   enable row level security;
alter table public.medias      enable row level security;
alter table public.documents   enable row level security;
alter table public.messages    enable row level security;
alter table public.prestataires enable row level security;
alter table public.audit_log   enable row level security;

-- Profils : chacun voit le sien
create policy "profil_own" on public.profiles
  for all using (auth.uid() = id);

-- Biens : propriétaire voit les siens, locataire voit son bien loué
create policy "biens_proprietaire" on public.biens
  for all using (proprietaire_id = auth.uid());

create policy "biens_locataire" on public.biens
  for select using (
    id in (
      select bien_id from public.locations
      where locataire_id = auth.uid() and statut = 'actif'
    )
  );

-- Incidents : locataire voit les siens, propriétaire voit ceux de ses biens
create policy "incidents_locataire" on public.incidents
  for all using (signale_par = auth.uid());

create policy "incidents_proprietaire" on public.incidents
  for all using (
    bien_id in (select id from public.biens where proprietaire_id = auth.uid())
  );

-- Médias : liés à un incident accessible
create policy "medias_access" on public.medias
  for all using (
    incident_id in (
      select id from public.incidents
      where signale_par = auth.uid()
         or bien_id in (select id from public.biens where proprietaire_id = auth.uid())
    )
  );

-- Documents : propriétaire gère, locataire voit les siens
create policy "documents_proprietaire" on public.documents
  for all using (uploaded_by = auth.uid());

create policy "documents_locataire" on public.documents
  for select using (
    bien_id in (
      select bien_id from public.locations
      where locataire_id = auth.uid() and statut = 'actif'
    )
  );

-- Messages : expéditeur ou destinataire
create policy "messages_access" on public.messages
  for all using (expediteur = auth.uid() or destinataire = auth.uid());

-- ============================================================
-- TRIGGERS — updated_at auto
-- ============================================================

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger incidents_updated_at
  before update on public.incidents
  for each row execute function update_updated_at();

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================

-- À créer dans Supabase Dashboard > Storage :
-- Bucket "medias"    → privé, taille max 100 Mo
-- Bucket "documents" → privé, taille max 50 Mo
-- Bucket "avatars"   → public, taille max 2 Mo

-- ============================================================
-- DONNÉES DE TEST (optionnel)
-- ============================================================

-- Insérez d'abord un utilisateur via l'Auth Supabase,
-- puis remplacez l'UUID ci-dessous par le vrai ID.

-- insert into public.profiles (id, role, nom, prenom) values
--   ('00000000-0000-0000-0000-000000000001', 'proprietaire', 'Durand', 'Jean'),
--   ('00000000-0000-0000-0000-000000000002', 'locataire', 'Lemaire', 'Marie');
