-- ============================================================
-- IMMOTRACK — Trigger profil auto + Catalogue complet
-- Exécuter dans : Supabase → SQL Editor → New query → Run
-- ============================================================

-- ── 1. TRIGGER : création automatique du profil à l'inscription
-- Lit le rôle, nom et prénom depuis les métadonnées Auth
-- ────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role, nom, prenom, telephone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role',    'locataire'),
    coalesce(new.raw_user_meta_data->>'nom',     'Utilisateur'),
    coalesce(new.raw_user_meta_data->>'prenom',  'Nouveau'),
    new.raw_user_meta_data->>'telephone'
  )
  on conflict (id) do update
    set role   = coalesce(excluded.role,   profiles.role),
        nom    = coalesce(excluded.nom,    profiles.nom),
        prenom = coalesce(excluded.prenom, profiles.prenom);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ── 2. TABLES DU CATALOGUE ──────────────────────────────────

-- Catégories de zones (intérieur, extérieur, communs…)
create table if not exists public.catalogue_zones (
  id    uuid default gen_random_uuid() primary key,
  nom   text not null unique,
  icone text,
  ordre int default 0
);

-- Types de pièces (cuisine, chambre, salon…)
create table if not exists public.catalogue_pieces (
  id       uuid default gen_random_uuid() primary key,
  zone_id  uuid references public.catalogue_zones(id) on delete cascade,
  nom      text not null,
  icone    text,
  ordre    int default 0,
  unique(zone_id, nom)
);

-- Types d'équipements (robinet, radiateur, volet…)
create table if not exists public.catalogue_equipements (
  id       uuid default gen_random_uuid() primary key,
  piece_id uuid references public.catalogue_pieces(id) on delete cascade,
  nom      text not null,
  icone    text,
  type     text,  -- plomberie, electricite, chauffage, menuiserie, structure…
  ordre    int default 0
);

-- Types de pannes par équipement
create table if not exists public.catalogue_pannes (
  id             uuid default gen_random_uuid() primary key,
  equipement_id  uuid references public.catalogue_equipements(id) on delete cascade,
  description    text not null,
  gravite_defaut text default 'moyen' check (gravite_defaut in ('faible','moyen','urgent')),
  ordre          int default 0
);

-- RLS : lecture publique pour tous les authentifiés
alter table public.catalogue_zones       enable row level security;
alter table public.catalogue_pieces      enable row level security;
alter table public.catalogue_equipements enable row level security;
alter table public.catalogue_pannes      enable row level security;

drop policy if exists "catalogue_read" on public.catalogue_zones;
drop policy if exists "catalogue_read" on public.catalogue_pieces;
drop policy if exists "catalogue_read" on public.catalogue_equipements;
drop policy if exists "catalogue_read" on public.catalogue_pannes;

create policy "catalogue_read" on public.catalogue_zones       for select using (auth.uid() is not null);
create policy "catalogue_read" on public.catalogue_pieces      for select using (auth.uid() is not null);
create policy "catalogue_read" on public.catalogue_equipements for select using (auth.uid() is not null);
create policy "catalogue_read" on public.catalogue_pannes      for select using (auth.uid() is not null);

-- Écriture : gestionnaire/propriétaire uniquement
create policy "catalogue_write" on public.catalogue_zones       for all using (auth.uid() in (select id from profiles where role in ('gestionnaire','proprietaire')));
create policy "catalogue_write" on public.catalogue_pieces      for all using (auth.uid() in (select id from profiles where role in ('gestionnaire','proprietaire')));
create policy "catalogue_write" on public.catalogue_equipements for all using (auth.uid() in (select id from profiles where role in ('gestionnaire','proprietaire')));
create policy "catalogue_write" on public.catalogue_pannes      for all using (auth.uid() in (select id from profiles where role in ('gestionnaire','proprietaire')));


-- ── 3. TABLE PLAN 2D DU BIEN ────────────────────────────────
create table if not exists public.plan_pieces (
  id        uuid default gen_random_uuid() primary key,
  bien_id   uuid references public.biens(id) on delete cascade not null,
  piece_id  uuid references public.pieces(id) on delete set null,
  nom       text not null,
  icone     text default '🏠',
  couleur   text default '#E8F2EB',
  x         int  default 0,   -- position grille
  y         int  default 0,
  w         int  default 2,   -- largeur en cellules
  h         int  default 2,   -- hauteur en cellules
  etage     int  default 0,   -- 0=RDC, 1=étage 1, -1=sous-sol
  created_at timestamptz default now()
);

alter table public.plan_pieces enable row level security;
drop policy if exists "plan_pieces_access" on public.plan_pieces;
create policy "plan_pieces_access" on public.plan_pieces
  for all using (
    bien_id in (select id from public.biens where proprietaire_id = auth.uid())
    or bien_id in (select bien_id from public.locations where locataire_id = auth.uid() and statut='actif')
  )
  with check (
    bien_id in (select id from public.biens where proprietaire_id = auth.uid())
  );


-- ══════════════════════════════════════════════════════════════
-- 4. DONNÉES DU CATALOGUE
-- ══════════════════════════════════════════════════════════════

-- ZONES
insert into public.catalogue_zones (nom, icone, ordre) values
  ('Intérieur',        '🏠', 1),
  ('Extérieur',        '🌿', 2),
  ('Parties communes', '🏢', 3),
  ('Local commercial', '🏪', 4)
on conflict (nom) do nothing;

-- ── PIÈCES INTÉRIEURES ──────────────────────────────────────
do $$ declare z_int uuid := (select id from catalogue_zones where nom='Intérieur');
begin
  insert into catalogue_pieces (zone_id, nom, icone, ordre) values
    (z_int, 'Entrée / Hall',         '🚪', 1),
    (z_int, 'Salon / Séjour',        '🛋️', 2),
    (z_int, 'Salle à manger',        '🍽️', 3),
    (z_int, 'Cuisine',               '🍳', 4),
    (z_int, 'Chambre parentale',     '🛏️', 5),
    (z_int, 'Chambre enfant',        '🧸', 6),
    (z_int, 'Chambre d''amis',       '🛏️', 7),
    (z_int, 'Bureau',                '💼', 8),
    (z_int, 'Salle de bain',         '🛁', 9),
    (z_int, 'Salle d''eau / Douche', '🚿', 10),
    (z_int, 'WC / Toilettes',        '🚽', 11),
    (z_int, 'Couloir / Dégagement',  '↔️', 12),
    (z_int, 'Buanderie / Lingerie',  '🧺', 13),
    (z_int, 'Dressing / Placard',    '👔', 14),
    (z_int, 'Véranda / Jardin d''hiver','🌿', 15),
    (z_int, 'Grenier / Combles',     '📦', 16),
    (z_int, 'Cave / Sous-sol',       '🔦', 17)
  on conflict do nothing;
end $$;

-- ── PIÈCES EXTÉRIEURES ──────────────────────────────────────
do $$ declare z_ext uuid := (select id from catalogue_zones where nom='Extérieur');
begin
  insert into catalogue_pieces (zone_id, nom, icone, ordre) values
    (z_ext, 'Façade / Murs extérieurs','🧱', 1),
    (z_ext, 'Toiture / Toit',         '🏠', 2),
    (z_ext, 'Balcon / Loggia',        '🌅', 3),
    (z_ext, 'Terrasse',               '☀️', 4),
    (z_ext, 'Jardin / Pelouse',       '🌿', 5),
    (z_ext, 'Allée / Chemin',         '🛤️', 6),
    (z_ext, 'Portail / Clôture',      '🚧', 7),
    (z_ext, 'Garage',                 '🚗', 8),
    (z_ext, 'Abri de jardin',         '🏚️', 9),
    (z_ext, 'Piscine',                '🏊', 10),
    (z_ext, 'Entrée extérieure',      '🔑', 11)
  on conflict do nothing;
end $$;

-- ── PARTIES COMMUNES ────────────────────────────────────────
do $$ declare z_com uuid := (select id from catalogue_zones where nom='Parties communes');
begin
  insert into catalogue_pieces (zone_id, nom, icone, ordre) values
    (z_com, 'Hall d''entrée immeuble', '🏢', 1),
    (z_com, 'Cage d''escalier',        '🪜', 2),
    (z_com, 'Ascenseur',               '🛗', 3),
    (z_com, 'Couloir commun',          '↔️', 4),
    (z_com, 'Local vélos',             '🚲', 5),
    (z_com, 'Local poubelles',         '🗑️', 6),
    (z_com, 'Parking commun',          '🅿️', 7),
    (z_com, 'Buanderie commune',       '🧺', 8),
    (z_com, 'Jardin commun',           '🌿', 9)
  on conflict do nothing;
end $$;

-- ── LOCAL COMMERCIAL ────────────────────────────────────────
do $$ declare z_loc uuid := (select id from catalogue_zones where nom='Local commercial');
begin
  insert into catalogue_pieces (zone_id, nom, icone, ordre) values
    (z_loc, 'Espace de vente / Showroom','🏪', 1),
    (z_loc, 'Bureau / Open space',       '💼', 2),
    (z_loc, 'Salle de réunion',          '👥', 3),
    (z_loc, 'Accueil / Réception',       '📋', 4),
    (z_loc, 'Entrepôt / Stockage',       '📦', 5),
    (z_loc, 'Vestiaires / Sanitaires',   '🚿', 6),
    (z_loc, 'Cuisine / Cafétéria',       '☕', 7),
    (z_loc, 'Parking client',            '🅿️', 8)
  on conflict do nothing;
end $$;


-- ══════════════════════════════════════════════════════════════
-- 5. ÉQUIPEMENTS ET PANNES PAR PIÈCE
-- ══════════════════════════════════════════════════════════════

do $$ 
declare
  p_entree     uuid := (select id from catalogue_pieces where nom='Entrée / Hall');
  p_salon      uuid := (select id from catalogue_pieces where nom='Salon / Séjour');
  p_cuisine    uuid := (select id from catalogue_pieces where nom='Cuisine');
  p_ch_par     uuid := (select id from catalogue_pieces where nom='Chambre parentale');
  p_ch_enf     uuid := (select id from catalogue_pieces where nom='Chambre enfant');
  p_ch_ami     uuid := (select id from catalogue_pieces where nom='Chambre d''amis');
  p_bureau     uuid := (select id from catalogue_pieces where nom='Bureau');
  p_sdb        uuid := (select id from catalogue_pieces where nom='Salle de bain');
  p_sde        uuid := (select id from catalogue_pieces where nom='Salle d''eau / Douche');
  p_wc         uuid := (select id from catalogue_pieces where nom='WC / Toilettes');
  p_couloir    uuid := (select id from catalogue_pieces where nom='Couloir / Dégagement');
  p_buanderie  uuid := (select id from catalogue_pieces where nom='Buanderie / Lingerie');
  p_toiture    uuid := (select id from catalogue_pieces where nom='Toiture / Toit');
  p_facade     uuid := (select id from catalogue_pieces where nom='Façade / Murs extérieurs');
  p_balcon     uuid := (select id from catalogue_pieces where nom='Balcon / Loggia');
  p_terrasse   uuid := (select id from catalogue_pieces where nom='Terrasse');
  p_jardin     uuid := (select id from catalogue_pieces where nom='Jardin / Pelouse');
  p_portail    uuid := (select id from catalogue_pieces where nom='Portail / Clôture');
  p_garage     uuid := (select id from catalogue_pieces where nom='Garage');
  p_entree_ext uuid := (select id from catalogue_pieces where nom='Entrée extérieure');
  p_ascenseur  uuid := (select id from catalogue_pieces where nom='Ascenseur');
  p_escalier   uuid := (select id from catalogue_pieces where nom='Cage d''escalier');
  p_hall_imm   uuid := (select id from catalogue_pieces where nom='Hall d''entrée immeuble');
  p_cave       uuid := (select id from catalogue_pieces where nom='Cave / Sous-sol');

  e uuid; -- temp id équipement
begin

  -- ── ENTRÉE ──
  insert into catalogue_equipements (piece_id, nom, icone, type) values
    (p_entree, 'Porte d''entrée',       '🚪', 'menuiserie'),
    (p_entree, 'Serrure / Verrou',      '🔐', 'menuiserie'),
    (p_entree, 'Sonnette / Carillon',   '🔔', 'electricite'),
    (p_entree, 'Interphone / Visiophone','📞','electricite'),
    (p_entree, 'Boîte aux lettres',     '📬', 'menuiserie'),
    (p_entree, 'Éclairage entrée',      '💡', 'electricite'),
    (p_entree, 'Carrelage / Sol',       '🟫', 'structure'),
    (p_entree, 'Digicode',             '🔢', 'electricite')
  on conflict do nothing;

  -- Pannes porte d'entrée
  e := (select id from catalogue_equipements where piece_id=p_entree and nom='Porte d''entrée');
  insert into catalogue_pannes (equipement_id, description, gravite_defaut) values
    (e, 'Porte qui ferme mal / ne ferme plus',    'urgent'),
    (e, 'Grincement / frottement',                'faible'),
    (e, 'Porte déformée / gonflée',               'moyen'),
    (e, 'Joint de porte usé / courant d''air',    'faible'),
    (e, 'Porte qui se bloque',                    'urgent')
  on conflict do nothing;

  e := (select id from catalogue_equipements where piece_id=p_entree and nom='Serrure / Verrou');
  insert into catalogue_pannes (equipement_id, description, gravite_defaut) values
    (e, 'Serrure bloquée / difficile à ouvrir',   'urgent'),
    (e, 'Clé cassée dans la serrure',             'urgent'),
    (e, 'Clé perdue — cylindre à remplacer',      'urgent'),
    (e, 'Verrou défaillant',                      'urgent'),
    (e, 'Serrure forcée / effractions',           'urgent')
  on conflict do nothing;

  e := (select id from catalogue_equipements where piece_id=p_entree and nom='Sonnette / Carillon');
  insert into catalogue_pannes (equipement_id, description, gravite_defaut) values
    (e, 'Sonnette ne fonctionne plus',            'faible'),
    (e, 'Pile de sonnette à changer',             'faible'),
    (e, 'Sonnette filaire HS',                   'moyen'),
    (e, 'Carillon ne sonne plus',                 'faible')
  on conflict do nothing;

  e := (select id from catalogue_equipements where piece_id=p_entree and nom='Interphone / Visiophone');
  insert into catalogue_pannes (equipement_id, description, gravite_defaut) values
    (e, 'Interphone ne fonctionne plus',          'moyen'),
    (e, 'Pas de son / son grésillant',            'moyen'),
    (e, 'Ouverture de porte impossible depuis l''interphone', 'urgent'),
    (e, 'Visiophone — image défaillante',         'moyen')
  on conflict do nothing;

  e := (select id from catalogue_equipements where piece_id=p_entree and nom='Boîte aux lettres');
  insert into catalogue_pannes (equipement_id, description, gravite_defaut) values
    (e, 'Serrure de boîte aux lettres HS',        'moyen'),
    (e, 'Clé de boîte perdue',                    'moyen'),
    (e, 'Boîte endommagée / déformée',            'faible'),
    (e, 'Boîte trop petite / courrier bloqué',    'faible')
  on conflict do nothing;

  -- ── CUISINE ──
  insert into catalogue_equipements (piece_id, nom, icone, type) values
    (p_cuisine, 'Robinet / Mitigeur évier',     '🚰', 'plomberie'),
    (p_cuisine, 'Évier',                        '🪣', 'plomberie'),
    (p_cuisine, 'Lave-vaisselle',               '🫧', 'plomberie'),
    (p_cuisine, 'Réfrigérateur / Congélateur',  '🧊', 'electricite'),
    (p_cuisine, 'Four / Cuisinière',            '🔥', 'electricite'),
    (p_cuisine, 'Hotte aspirante',              '💨', 'electricite'),
    (p_cuisine, 'Micro-ondes',                  '📡', 'electricite'),
    (p_cuisine, 'Placard / Meuble de cuisine',  '🗄️', 'menuiserie'),
    (p_cuisine, 'Fenêtre cuisine',              '🪟', 'menuiserie'),
    (p_cuisine, 'Carrelage / Crédence',         '🟫', 'structure'),
    (p_cuisine, 'Prises électriques',           '🔌', 'electricite'),
    (p_cuisine, 'Chauffe-eau / Ballon',         '💧', 'plomberie'),
    (p_cuisine, 'Radiateur cuisine',            '🌡️', 'chauffage'),
    (p_cuisine, 'Vide-ordures',                 '🗑️', 'plomberie')
  on conflict do nothing;

  e := (select id from catalogue_equipements where piece_id=p_cuisine and nom='Robinet / Mitigeur évier');
  insert into catalogue_pannes (equipement_id, description, gravite_defaut) values
    (e, 'Fuite au niveau du robinet',            'urgent'),
    (e, 'Robinet qui goutte',                    'moyen'),
    (e, 'Pression d''eau insuffisante',          'moyen'),
    (e, 'Eau chaude absente / insuffisante',     'urgent'),
    (e, 'Robinet bloqué / ne tourne plus',       'urgent'),
    (e, 'Jet d''eau dévié / aérateur bouché',   'faible')
  on conflict do nothing;

  e := (select id from catalogue_equipements where piece_id=p_cuisine and nom='Évier');
  insert into catalogue_pannes (equipement_id, description, gravite_defaut) values
    (e, 'Évier bouché / évacuation lente',       'moyen'),
    (e, 'Fuite sous l''évier (siphon)',          'urgent'),
    (e, 'Mauvaises odeurs remontant du siphon',  'moyen'),
    (e, 'Évier fissuré / ébréché',              'moyen')
  on conflict do nothing;

  e := (select id from catalogue_equipements where piece_id=p_cuisine and nom='Lave-vaisselle');
  insert into catalogue_pannes (equipement_id, description, gravite_defaut) values
    (e, 'Lave-vaisselle ne démarre pas',         'moyen'),
    (e, 'Fuite d''eau sous le lave-vaisselle',  'urgent'),
    (e, 'Vaisselle mal lavée / reste de dépôt', 'faible'),
    (e, 'Bruit anormal pendant le cycle',        'moyen'),
    (e, 'Porte qui ne ferme plus',               'moyen'),
    (e, 'Programme bloqué / display HS',         'moyen')
  on conflict do nothing;

  e := (select id from catalogue_equipements where piece_id=p_cuisine and nom='Four / Cuisinière');
  insert into catalogue_pannes (equipement_id, description, gravite_defaut) values
    (e, 'Four ne chauffe plus',                  'moyen'),
    (e, 'Plaque de cuisson HS',                  'moyen'),
    (e, 'Problème de gaz / odeur de gaz',        'urgent'),
    (e, 'Thermostat défaillant',                 'moyen'),
    (e, 'Porte du four cassée / joint HS',       'moyen'),
    (e, 'Minuterie / timer défaillant',          'faible')
  on conflict do nothing;

  e := (select id from catalogue_equipements where piece_id=p_cuisine and nom='Hotte aspirante');
  insert into catalogue_pannes (equipement_id, description, gravite_defaut) values
    (e, 'Hotte ne fonctionne plus',              'faible'),
    (e, 'Hotte bruyante / vibrante',             'faible'),
    (e, 'Lumière de hotte HS',                   'faible'),
    (e, 'Filtre bouché',                         'faible')
  on conflict do nothing;

  -- ── SALON / SÉJOUR ──
  insert into catalogue_equipements (piece_id, nom, icone, type) values
    (p_salon, 'Radiateur salon',           '🌡️', 'chauffage'),
    (p_salon, 'Prises électriques',        '🔌', 'electricite'),
    (p_salon, 'Éclairage / Lustre',        '💡', 'electricite'),
    (p_salon, 'Interrupteurs',             '🔘', 'electricite'),
    (p_salon, 'Fenêtres / Baies vitrées', '🪟', 'menuiserie'),
    (p_salon, 'Volets roulants / Persiennes','🪟','menuiserie'),
    (p_salon, 'Parquet / Sol',             '🟫', 'structure'),
    (p_salon, 'Murs / Plafond',            '🧱', 'structure'),
    (p_salon, 'Cheminée / Insert',         '🔥', 'chauffage'),
    (p_salon, 'Climatiseur / PAC',         '❄️', 'chauffage'),
    (p_salon, 'Portail TV / Antenne',      '📺', 'electricite'),
    (p_salon, 'VMC / Ventilation',         '💨', 'plomberie')
  on conflict do nothing;

  e := (select id from catalogue_equipements where piece_id=p_salon and nom='Radiateur salon');
  insert into catalogue_pannes (equipement_id, description, gravite_defaut) values
    (e, 'Radiateur ne chauffe plus',             'urgent'),
    (e, 'Radiateur fait du bruit (cognements)',  'moyen'),
    (e, 'Fuite sur le radiateur',               'urgent'),
    (e, 'Robinet thermostatique bloqué',         'moyen'),
    (e, 'Radiateur chauffe insuffisamment',      'moyen'),
    (e, 'Radiateur trop chaud / incontrôlable', 'moyen')
  on conflict do nothing;

  e := (select id from catalogue_equipements where piece_id=p_salon and nom='Fenêtres / Baies vitrées');
  insert into catalogue_pannes (equipement_id, description, gravite_defaut) values
    (e, 'Fenêtre qui ferme mal',                 'moyen'),
    (e, 'Joint usé / courant d''air',            'moyen'),
    (e, 'Condensation entre les vitres',         'moyen'),
    (e, 'Vitre fissurée / cassée',              'urgent'),
    (e, 'Poignée de fenêtre cassée',             'moyen'),
    (e, 'Gond / pivot défaillant',               'moyen')
  on conflict do nothing;

  e := (select id from catalogue_equipements where piece_id=p_salon and nom='Volets roulants / Persiennes');
  insert into catalogue_pannes (equipement_id, description, gravite_defaut) values
    (e, 'Volet roulant bloqué (ne monte plus)',  'moyen'),
    (e, 'Moteur de volet HS',                    'moyen'),
    (e, 'Télécommande de volet HS',              'faible'),
    (e, 'Lame de volet cassée / décrochée',      'moyen'),
    (e, 'Sangle de volet cassée',                'moyen'),
    (e, 'Volet bruyant lors de l''ouverture',   'faible')
  on conflict do nothing;

  e := (select id from catalogue_equipements where piece_id=p_salon and nom='Murs / Plafond');
  insert into catalogue_pannes (equipement_id, description, gravite_defaut) values
    (e, 'Fissure dans le mur / plafond',         'moyen'),
    (e, 'Tâche d''humidité / auréole',           'urgent'),
    (e, 'Peinture qui se décolle / cloque',      'faible'),
    (e, 'Moisissures sur le mur',               'urgent'),
    (e, 'Papier peint qui se décolle',           'faible'),
    (e, 'Fissure structurelle importante',       'urgent')
  on conflict do nothing;

  e := (select id from catalogue_equipements where piece_id=p_salon and nom='Cheminée / Insert');
  insert into catalogue_pannes (equipement_id, description, gravite_defaut) values
    (e, 'Tirage insuffisant / fumée dans la pièce','urgent'),
    (e, 'Besoin de ramonage',                    'moyen'),
    (e, 'Fissure dans le conduit',              'urgent'),
    (e, 'Vitre de l''insert cassée',            'urgent')
  on conflict do nothing;

  -- ── CHAMBRES (parentale, enfant, amis, bureau — équipements identiques) ──
  for p_entree in select unnest(array[p_ch_par, p_ch_enf, p_ch_ami, p_bureau]) loop
    insert into catalogue_equipements (piece_id, nom, icone, type) values
      (p_entree, 'Radiateur chambre',            '🌡️', 'chauffage'),
      (p_entree, 'Volet roulant / Store',        '🪟', 'menuiserie'),
      (p_entree, 'Fenêtre chambre',              '🪟', 'menuiserie'),
      (p_entree, 'Porte de chambre',             '🚪', 'menuiserie'),
      (p_entree, 'Prises électriques',           '🔌', 'electricite'),
      (p_entree, 'Éclairage chambre',            '💡', 'electricite'),
      (p_entree, 'Placard intégré / Dressing',   '👔', 'menuiserie'),
      (p_entree, 'Climatiseur / PAC',            '❄️', 'chauffage'),
      (p_entree, 'Murs / Plafond chambre',       '🧱', 'structure'),
      (p_entree, 'Sol (parquet/moquette)',        '🟫', 'structure')
    on conflict do nothing;

    e := (select id from catalogue_equipements where piece_id=p_entree and nom='Radiateur chambre');
    insert into catalogue_pannes (equipement_id, description, gravite_defaut) values
      (e, 'Radiateur ne chauffe plus',           'urgent'),
      (e, 'Bruit de cognement / claquement',     'moyen'),
      (e, 'Fuite sur le radiateur',              'urgent'),
      (e, 'Radiateur chauffe insuffisamment',    'moyen')
    on conflict do nothing;

    e := (select id from catalogue_equipements where piece_id=p_entree and nom='Volet roulant / Store');
    insert into catalogue_pannes (equipement_id, description, gravite_defaut) values
      (e, 'Volet bloqué / ne monte plus',        'moyen'),
      (e, 'Moteur HS',                           'moyen'),
      (e, 'Lame cassée / décrochée',             'moyen'),
      (e, 'Sangle cassée',                       'faible'),
      (e, 'Store ne s''enroule plus',            'faible')
    on conflict do nothing;
  end loop;

  -- ── SALLE DE BAIN ──
  insert into catalogue_equipements (piece_id, nom, icone, type) values
    (p_sdb, 'Baignoire',                         '🛁', 'plomberie'),
    (p_sdb, 'Robinet / Mitigeur baignoire',      '🚰', 'plomberie'),
    (p_sdb, 'Douche (dans baignoire)',           '🚿', 'plomberie'),
    (p_sdb, 'Lavabo / Vasque',                   '🪣', 'plomberie'),
    (p_sdb, 'Robinet lavabo',                    '🚰', 'plomberie'),
    (p_sdb, 'Radiateur sèche-serviettes',        '🌡️', 'chauffage'),
    (p_sdb, 'VMC / Ventilation SDB',             '💨', 'plomberie'),
    (p_sdb, 'Miroir / Armoire de toilette',      '🪞', 'structure'),
    (p_sdb, 'Éclairage salle de bain',           '💡', 'electricite'),
    (p_sdb, 'Carrelage murs / sol',              '🟫', 'structure'),
    (p_sdb, 'WC dans SDB',                       '🚽', 'plomberie'),
    (p_sdb, 'Prises électriques (rasoir)',       '🔌', 'electricite')
  on conflict do nothing;

  e := (select id from catalogue_equipements where piece_id=p_sdb and nom='Baignoire');
  insert into catalogue_pannes (equipement_id, description, gravite_defaut) values
    (e, 'Baignoire bouchée / évacuation lente',  'moyen'),
    (e, 'Email abîmé / fissure',                'moyen'),
    (e, 'Fuite au niveau du bac',               'urgent'),
    (e, 'Joint de baignoire décollé / noirci',   'moyen')
  on conflict do nothing;

  e := (select id from catalogue_equipements where piece_id=p_sdb and nom='Radiateur sèche-serviettes');
  insert into catalogue_pannes (equipement_id, description, gravite_defaut) values
    (e, 'Sèche-serviettes ne chauffe plus',      'moyen'),
    (e, 'Fuite sur le sèche-serviettes',        'urgent'),
    (e, 'Sèche-serviettes brûlant / incontrôlable','moyen'),
    (e, 'Robinet thermostatique bloqué',         'moyen')
  on conflict do nothing;

  e := (select id from catalogue_equipements where piece_id=p_sdb and nom='VMC / Ventilation SDB');
  insert into catalogue_pannes (equipement_id, description, gravite_defaut) values
    (e, 'VMC ne fonctionne plus',               'moyen'),
    (e, 'VMC bruyante',                          'faible'),
    (e, 'Condensation excessive / humidité',    'urgent'),
    (e, 'Moisissures au plafond',               'urgent')
  on conflict do nothing;

  -- ── SALLE D'EAU / DOUCHE ──
  insert into catalogue_equipements (piece_id, nom, icone, type) values
    (p_sde, 'Cabine de douche / Paroi',          '🚿', 'plomberie'),
    (p_sde, 'Receveur de douche',                '🪣', 'plomberie'),
    (p_sde, 'Robinet / Mitigeur douche',         '🚰', 'plomberie'),
    (p_sde, 'Pommeau de douche',                 '🚿', 'plomberie'),
    (p_sde, 'VMC / Ventilation',                 '💨', 'plomberie'),
    (p_sde, 'Éclairage',                         '💡', 'electricite'),
    (p_sde, 'Carrelage murs / sol',              '🟫', 'structure')
  on conflict do nothing;

  e := (select id from catalogue_equipements where piece_id=p_sde and nom='Cabine de douche / Paroi');
  insert into catalogue_pannes (equipement_id, description, gravite_defaut) values
    (e, 'Paroi de douche cassée / fissurée',    'urgent'),
    (e, 'Joint de douche décollé / fuite',      'urgent'),
    (e, 'Porte coulissante bloquée',             'moyen'),
    (e, 'Fuite au niveau du receveur',          'urgent')
  on conflict do nothing;

  e := (select id from catalogue_equipements where piece_id=p_sde and nom='Pommeau de douche');
  insert into catalogue_pannes (equipement_id, description, gravite_defaut) values
    (e, 'Pommeau calcaire / jet irrégulier',    'faible'),
    (e, 'Pommeau cassé',                         'moyen'),
    (e, 'Flexible percé / qui fuit',            'moyen'),
    (e, 'Support de pommeau cassé',              'faible')
  on conflict do nothing;

  -- ── WC ──
  insert into catalogue_equipements (piece_id, nom, icone, type) values
    (p_wc, 'Cuvette WC',                         '🚽', 'plomberie'),
    (p_wc, 'Mécanisme de chasse d''eau',         '💧', 'plomberie'),
    (p_wc, 'Réservoir de chasse',                '🪣', 'plomberie'),
    (p_wc, 'Abattant WC',                        '🚽', 'structure'),
    (p_wc, 'Éclairage WC',                       '💡', 'electricite'),
    (p_wc, 'VMC WC',                             '💨', 'plomberie')
  on conflict do nothing;

  e := (select id from catalogue_equipements where piece_id=p_wc and nom='Mécanisme de chasse d''eau');
  insert into catalogue_pannes (equipement_id, description, gravite_defaut) values
    (e, 'Chasse d''eau qui ne se déclenche pas', 'urgent'),
    (e, 'Chasse d''eau qui coule en permanence', 'moyen'),
    (e, 'Chasse d''eau bruyante',               'faible'),
    (e, 'Réservoir qui se remplit lentement',   'moyen'),
    (e, 'Bouton de chasse cassé',               'moyen')
  on conflict do nothing;

  e := (select id from catalogue_equipements where piece_id=p_wc and nom='Cuvette WC');
  insert into catalogue_pannes (equipement_id, description, gravite_defaut) values
    (e, 'Fuite au pied du WC',                  'urgent'),
    (e, 'Cuvette fissurée',                     'urgent'),
    (e, 'WC bouché',                             'urgent'),
    (e, 'Mauvaises odeurs persistantes',        'moyen')
  on conflict do nothing;

  -- ── BUANDERIE ──
  insert into catalogue_equipements (piece_id, nom, icone, type) values
    (p_buanderie, 'Lave-linge',                  '🫧', 'plomberie'),
    (p_buanderie, 'Sèche-linge',                 '💨', 'electricite'),
    (p_buanderie, 'Évacuation / arrivée eau',    '💧', 'plomberie'),
    (p_buanderie, 'Éclairage',                   '💡', 'electricite'),
    (p_buanderie, 'Prises électriques',          '🔌', 'electricite')
  on conflict do nothing;

  e := (select id from catalogue_equipements where piece_id=p_buanderie and nom='Lave-linge');
  insert into catalogue_pannes (equipement_id, description, gravite_defaut) values
    (e, 'Lave-linge ne démarre pas',            'moyen'),
    (e, 'Fuite sous le lave-linge',             'urgent'),
    (e, 'Tambour ne tourne pas / programme bloqué','moyen'),
    (e, 'Porte de lave-linge bloquée',          'moyen'),
    (e, 'Vibrations excessives',                 'faible')
  on conflict do nothing;

  -- ── TOITURE ──
  insert into catalogue_equipements (piece_id, nom, icone, type) values
    (p_toiture, 'Ardoises / Tuiles',             '🏠', 'structure'),
    (p_toiture, 'Zinguerie (gouttières/chéneaux)','💧','plomberie'),
    (p_toiture, 'Descentes d''eau pluviale',     '💧', 'plomberie'),
    (p_toiture, 'Velux / Fenêtre de toit',       '🪟', 'menuiserie'),
    (p_toiture, 'Conduit de cheminée',           '🔥', 'structure'),
    (p_toiture, 'Isolation toiture',             '🏠', 'structure'),
    (p_toiture, 'Antenne TV / Parabole',         '📡', 'electricite')
  on conflict do nothing;

  e := (select id from catalogue_equipements where piece_id=p_toiture and nom='Ardoises / Tuiles');
  insert into catalogue_pannes (equipement_id, description, gravite_defaut) values
    (e, 'Ardoises / tuiles manquantes ou cassées','urgent'),
    (e, 'Infiltration d''eau / fuite de toiture','urgent'),
    (e, 'Mousse / végétation sur la toiture',   'moyen'),
    (e, 'Faîtage endommagé',                    'urgent')
  on conflict do nothing;

  e := (select id from catalogue_equipements where piece_id=p_toiture and nom='Zinguerie (gouttières/chéneaux)');
  insert into catalogue_pannes (equipement_id, description, gravite_defaut) values
    (e, 'Gouttière bouchée (feuilles/débris)',  'moyen'),
    (e, 'Gouttière percée / fuite',             'urgent'),
    (e, 'Gouttière mal fixée / pendante',       'urgent'),
    (e, 'Débordement lors des pluies',          'urgent')
  on conflict do nothing;

  e := (select id from catalogue_equipements where piece_id=p_toiture and nom='Velux / Fenêtre de toit');
  insert into catalogue_pannes (equipement_id, description, gravite_defaut) values
    (e, 'Velux qui laisse passer la pluie',     'urgent'),
    (e, 'Velux difficile à ouvrir / fermer',    'moyen'),
    (e, 'Vitrage du velux cassé / fissuré',     'urgent'),
    (e, 'Joint de velux usé',                   'moyen'),
    (e, 'Store de velux HS',                    'faible')
  on conflict do nothing;

  -- ── FAÇADE ──
  insert into catalogue_equipements (piece_id, nom, icone, type) values
    (p_facade, 'Enduit / Crépi façade',          '🧱', 'structure'),
    (p_facade, 'Fissures façade',                '🧱', 'structure'),
    (p_facade, 'Peinture extérieure',            '🎨', 'structure'),
    (p_facade, 'Isolation extérieure',           '🏠', 'structure'),
    (p_facade, 'Humidité remontante',            '💧', 'plomberie')
  on conflict do nothing;

  e := (select id from catalogue_equipements where piece_id=p_facade and nom='Fissures façade');
  insert into catalogue_pannes (equipement_id, description, gravite_defaut) values
    (e, 'Fissure fine (lézarde)',               'moyen'),
    (e, 'Fissure large (structurelle)',         'urgent'),
    (e, 'Enduit qui se décolle / tombe',        'urgent'),
    (e, 'Infiltration via la façade',           'urgent')
  on conflict do nothing;

  -- ── BALCON / TERRASSE ──
  for p_entree in select unnest(array[p_balcon, p_terrasse]) loop
    insert into catalogue_equipements (piece_id, nom, icone, type) values
      (p_entree, 'Garde-corps / Rambarde',       '🚧', 'structure'),
      (p_entree, 'Sol (carrelage/bois)',          '🟫', 'structure'),
      (p_entree, 'Évacuation des eaux',           '💧', 'plomberie'),
      (p_entree, 'Éclairage extérieur',           '💡', 'electricite'),
      (p_entree, 'Porte-fenêtre / Baie',          '🪟', 'menuiserie'),
      (p_entree, 'Store / Pergola',               '☀️', 'menuiserie')
    on conflict do nothing;

    e := (select id from catalogue_equipements where piece_id=p_entree and nom='Garde-corps / Rambarde');
    insert into catalogue_pannes (equipement_id, description, gravite_defaut) values
      (e, 'Garde-corps descellé / instable',     'urgent'),
      (e, 'Barreau cassé / manquant',            'urgent'),
      (e, 'Rouille importante',                  'moyen')
    on conflict do nothing;

    e := (select id from catalogue_equipements where piece_id=p_entree and nom='Évacuation des eaux');
    insert into catalogue_pannes (equipement_id, description, gravite_defaut) values
      (e, 'Terrasse qui retient l''eau (stagnation)','moyen'),
      (e, 'Siphon de terrasse bouché',           'moyen'),
      (e, 'Infiltration vers l''intérieur',      'urgent')
    on conflict do nothing;
  end loop;

  -- ── PORTAIL / CLÔTURE ──
  insert into catalogue_equipements (piece_id, nom, icone, type) values
    (p_portail, 'Portail motorisé',              '🚧', 'electricite'),
    (p_portail, 'Portail manuel',                '🚧', 'menuiserie'),
    (p_portail, 'Portillon',                     '🚪', 'menuiserie'),
    (p_portail, 'Clôture / Grillage',            '🔗', 'structure'),
    (p_portail, 'Télécommande portail',          '📱', 'electricite'),
    (p_portail, 'Interphone portail',            '📞', 'electricite')
  on conflict do nothing;

  e := (select id from catalogue_equipements where piece_id=p_portail and nom='Portail motorisé');
  insert into catalogue_pannes (equipement_id, description, gravite_defaut) values
    (e, 'Portail ne s''ouvre plus (moteur HS)', 'urgent'),
    (e, 'Télécommande ne fonctionne plus',       'urgent'),
    (e, 'Portail qui se referme tout seul',      'moyen'),
    (e, 'Portail bruyant à l''ouverture',        'faible'),
    (e, 'Butée / fin de course HS',              'moyen'),
    (e, 'Portail déraillé / sorti de rail',      'urgent')
  on conflict do nothing;

  -- ── GARAGE ──
  insert into catalogue_equipements (piece_id, nom, icone, type) values
    (p_garage, 'Porte de garage motorisée',      '🚗', 'electricite'),
    (p_garage, 'Porte de garage manuelle',       '🚗', 'menuiserie'),
    (p_garage, 'Éclairage garage',               '💡', 'electricite'),
    (p_garage, 'Prises électriques',             '🔌', 'electricite'),
    (p_garage, 'Sol béton / revêtement',         '🟫', 'structure'),
    (p_garage, 'Télécommande garage',            '📱', 'electricite')
  on conflict do nothing;

  e := (select id from catalogue_equipements where piece_id=p_garage and nom='Porte de garage motorisée');
  insert into catalogue_pannes (equipement_id, description, gravite_defaut) values
    (e, 'Porte de garage ne s''ouvre plus',     'urgent'),
    (e, 'Télécommande HS / pile à changer',      'moyen'),
    (e, 'Ressort de porte cassé',               'urgent'),
    (e, 'Moteur de porte HS',                   'urgent'),
    (e, 'Porte déformée / qui frotte',          'moyen'),
    (e, 'Rail abîmé / bloqué',                  'moyen')
  on conflict do nothing;

  -- ── ENTRÉE EXTÉRIEURE (sonnette, boîte aux lettres, digicode) ──
  insert into catalogue_equipements (piece_id, nom, icone, type) values
    (p_entree_ext, 'Sonnette / Carillon ext.',   '🔔', 'electricite'),
    (p_entree_ext, 'Boîte aux lettres',          '📬', 'menuiserie'),
    (p_entree_ext, 'Digicode / Visiophone ext.', '🔢', 'electricite'),
    (p_entree_ext, 'Éclairage extérieur',        '💡', 'electricite'),
    (p_entree_ext, 'Détecteur de mouvement',     '👁️', 'electricite')
  on conflict do nothing;

  -- ── HALL IMMEUBLE ──
  insert into catalogue_equipements (piece_id, nom, icone, type) values
    (p_hall_imm, 'Porte d''entrée immeuble',     '🚪', 'menuiserie'),
    (p_hall_imm, 'Digicode immeuble',            '🔢', 'electricite'),
    (p_hall_imm, 'Interphone général',           '📞', 'electricite'),
    (p_hall_imm, 'Éclairage hall',               '💡', 'electricite'),
    (p_hall_imm, 'Boîtes aux lettres',           '📬', 'menuiserie'),
    (p_hall_imm, 'Vide-ordures',                 '🗑️', 'plomberie')
  on conflict do nothing;

  e := (select id from catalogue_equipements where piece_id=p_hall_imm and nom='Porte d''entrée immeuble');
  insert into catalogue_pannes (equipement_id, description, gravite_defaut) values
    (e, 'Porte qui ne se ferme plus',            'urgent'),
    (e, 'Gâche électrique HS',                   'urgent'),
    (e, 'Bras de fermeture défaillant',          'moyen'),
    (e, 'Vitre de porte brisée',                 'urgent')
  on conflict do nothing;

  -- ── ASCENSEUR ──
  insert into catalogue_equipements (piece_id, nom, icone, type) values
    (p_ascenseur, 'Cabine d''ascenseur',         '🛗', 'electricite'),
    (p_ascenseur, 'Portes d''ascenseur',         '🚪', 'electricite'),
    (p_ascenseur, 'Boutons / Commandes',         '🔘', 'electricite'),
    (p_ascenseur, 'Alarme ascenseur',            '🚨', 'electricite')
  on conflict do nothing;

  e := (select id from catalogue_equipements where piece_id=p_ascenseur and nom='Cabine d''ascenseur');
  insert into catalogue_pannes (equipement_id, description, gravite_defaut) values
    (e, 'Ascenseur en panne / bloqué',           'urgent'),
    (e, 'Porte qui se bloque à l''ouverture',   'urgent'),
    (e, 'Bruit anormal / secousses',             'moyen'),
    (e, 'Cabine en décalage avec le palier',     'urgent'),
    (e, 'Bouton d''étage HS',                   'moyen'),
    (e, 'Éclairage cabine HS',                  'faible')
  on conflict do nothing;

  -- ── CAGE D'ESCALIER ──
  insert into catalogue_equipements (piece_id, nom, icone, type) values
    (p_escalier, 'Main courante / Rampe',        '🪜', 'structure'),
    (p_escalier, 'Éclairage parties communes',   '💡', 'electricite'),
    (p_escalier, 'Détecteur de présence',        '👁️', 'electricite'),
    (p_escalier, 'Marches / Revêtement sol',     '🪜', 'structure')
  on conflict do nothing;

  e := (select id from catalogue_equipements where piece_id=p_escalier and nom='Main courante / Rampe');
  insert into catalogue_pannes (equipement_id, description, gravite_defaut) values
    (e, 'Main courante descellée / instable',    'urgent'),
    (e, 'Barreau cassé / manquant',              'urgent'),
    (e, 'Rampe branlante',                       'urgent')
  on conflict do nothing;

  e := (select id from catalogue_equipements where piece_id=p_escalier and nom='Éclairage parties communes');
  insert into catalogue_pannes (equipement_id, description, gravite_defaut) values
    (e, 'Lumière qui ne s''allume pas',          'moyen'),
    (e, 'Détecteur de présence HS',             'moyen'),
    (e, 'Ampoule grillée',                       'faible'),
    (e, 'Minuterie réglée trop courte',          'faible')
  on conflict do nothing;

  -- ── CAVE ──
  insert into catalogue_equipements (piece_id, nom, icone, type) values
    (p_cave, 'Porte de cave',                    '🚪', 'menuiserie'),
    (p_cave, 'Éclairage cave',                   '💡', 'electricite'),
    (p_cave, 'Humidité / infiltrations',         '💧', 'plomberie'),
    (p_cave, 'Sol cave',                         '🟫', 'structure')
  on conflict do nothing;

  e := (select id from catalogue_equipements where piece_id=p_cave and nom='Humidité / infiltrations');
  insert into catalogue_pannes (equipement_id, description, gravite_defaut) values
    (e, 'Eau stagnante dans la cave',            'urgent'),
    (e, 'Moisissures / champignons',             'urgent'),
    (e, 'Infiltration par les murs',             'urgent'),
    (e, 'Odeur de moisi importante',             'moyen')
  on conflict do nothing;

end $$;

-- ══════════════════════════════════════════════════════════════
-- 6. VÉRIFICATION
-- ══════════════════════════════════════════════════════════════
select 
  (select count(*) from catalogue_zones)        as zones,
  (select count(*) from catalogue_pieces)       as pieces,
  (select count(*) from catalogue_equipements)  as equipements,
  (select count(*) from catalogue_pannes)       as pannes;

