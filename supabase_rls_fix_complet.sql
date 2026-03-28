-- ============================================================
-- IMMOTRACK — Correctif RLS complet
-- À exécuter dans : Supabase → SQL Editor → New query → Run
-- Ce script supprime toutes les anciennes politiques
-- et les recrée correctement pour chaque opération.
-- ============================================================

-- ── 1. SUPPRIMER TOUTES LES ANCIENNES POLITIQUES ─────────
drop policy if exists "profil_own"               on public.profiles;
drop policy if exists "profiles_insert_own"      on public.profiles;
drop policy if exists "profiles_select_own"      on public.profiles;
drop policy if exists "profiles_update_own"      on public.profiles;
drop policy if exists "profiles_select_linked"   on public.profiles;
drop policy if exists "biens_proprietaire"       on public.biens;
drop policy if exists "biens_locataire"          on public.biens;
drop policy if exists "locations_proprietaire"   on public.locations;
drop policy if exists "locations_locataire"      on public.locations;
drop policy if exists "pieces_access"            on public.pieces;
drop policy if exists "elements_access"          on public.elements;
drop policy if exists "incidents_locataire"      on public.incidents;
drop policy if exists "incidents_proprietaire"   on public.incidents;
drop policy if exists "medias_access"            on public.medias;
drop policy if exists "documents_proprietaire"   on public.documents;
drop policy if exists "documents_locataire"      on public.documents;
drop policy if exists "messages_access"          on public.messages;
drop policy if exists "prestataires_access"      on public.prestataires;
drop policy if exists "audit_log_access"         on public.audit_log;


-- ════════════════════════════════════════════════════════════
-- 2. PROFILES
-- Problème original : "for all using" bloque les INSERT
-- car "using" ne s'applique pas aux insertions.
-- ════════════════════════════════════════════════════════════

-- Créer son propre profil à l'inscription
create policy "profiles_insert_own" on public.profiles
  for insert
  with check (auth.uid() = id);

-- Lire son propre profil
create policy "profiles_select_own" on public.profiles
  for select
  using (auth.uid() = id);

-- Modifier son propre profil
create policy "profiles_update_own" on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Supprimer son propre profil
create policy "profiles_delete_own" on public.profiles
  for delete
  using (auth.uid() = id);

-- Un propriétaire peut lire les profils de ses locataires
-- Un locataire peut lire le profil de son propriétaire
create policy "profiles_select_linked" on public.profiles
  for select
  using (
    -- Je suis propriétaire → je vois mes locataires
    id in (
      select l.locataire_id from public.locations l
      join public.biens b on b.id = l.bien_id
      where b.proprietaire_id = auth.uid()
        and l.locataire_id is not null
    )
    or
    -- Je suis locataire → je vois mon propriétaire
    id in (
      select b.proprietaire_id from public.biens b
      join public.locations l on l.bien_id = b.id
      where l.locataire_id = auth.uid()
        and l.statut = 'actif'
    )
  );


-- ════════════════════════════════════════════════════════════
-- 3. BIENS
-- Problème : "for all using" autorise toutes les opérations
-- avec la même condition, mais un locataire ne doit pas
-- pouvoir modifier ou supprimer un bien.
-- ════════════════════════════════════════════════════════════

-- Propriétaire : CRUD complet sur ses biens
create policy "biens_proprietaire_all" on public.biens
  for all
  using (proprietaire_id = auth.uid())
  with check (proprietaire_id = auth.uid());

-- Locataire : lecture seule de son bien loué
create policy "biens_locataire_select" on public.biens
  for select
  using (
    id in (
      select bien_id from public.locations
      where locataire_id = auth.uid()
        and statut = 'actif'
    )
  );


-- ════════════════════════════════════════════════════════════
-- 4. LOCATIONS
-- Manquant totalement dans le schéma original !
-- Sans politiques, RLS bloque tout accès à cette table.
-- ════════════════════════════════════════════════════════════

-- Propriétaire : CRUD complet sur ses locations
create policy "locations_proprietaire_all" on public.locations
  for all
  using (
    bien_id in (
      select id from public.biens
      where proprietaire_id = auth.uid()
    )
  )
  with check (
    bien_id in (
      select id from public.biens
      where proprietaire_id = auth.uid()
    )
  );

-- Locataire : lecture seule de sa location active
create policy "locations_locataire_select" on public.locations
  for select
  using (locataire_id = auth.uid());


-- ════════════════════════════════════════════════════════════
-- 5. PIECES
-- Manquant totalement dans le schéma original !
-- ════════════════════════════════════════════════════════════

-- Propriétaire : CRUD complet sur les pièces de ses biens
create policy "pieces_proprietaire_all" on public.pieces
  for all
  using (
    bien_id in (
      select id from public.biens
      where proprietaire_id = auth.uid()
    )
  )
  with check (
    bien_id in (
      select id from public.biens
      where proprietaire_id = auth.uid()
    )
  );

-- Locataire : lecture des pièces de son bien loué
create policy "pieces_locataire_select" on public.pieces
  for select
  using (
    bien_id in (
      select bien_id from public.locations
      where locataire_id = auth.uid()
        and statut = 'actif'
    )
  );


-- ════════════════════════════════════════════════════════════
-- 6. ELEMENTS
-- Manquant totalement dans le schéma original !
-- ════════════════════════════════════════════════════════════

-- Propriétaire : CRUD complet sur les éléments de ses pièces
create policy "elements_proprietaire_all" on public.elements
  for all
  using (
    piece_id in (
      select p.id from public.pieces p
      join public.biens b on b.id = p.bien_id
      where b.proprietaire_id = auth.uid()
    )
  )
  with check (
    piece_id in (
      select p.id from public.pieces p
      join public.biens b on b.id = p.bien_id
      where b.proprietaire_id = auth.uid()
    )
  );

-- Locataire : lecture des éléments de son bien loué
create policy "elements_locataire_select" on public.elements
  for select
  using (
    piece_id in (
      select p.id from public.pieces p
      join public.locations l on l.bien_id = p.bien_id
      where l.locataire_id = auth.uid()
        and l.statut = 'actif'
    )
  );


-- ════════════════════════════════════════════════════════════
-- 7. INCIDENTS
-- Problème : "for all using" autorise le locataire à modifier
-- les incidents du propriétaire et inversement.
-- ════════════════════════════════════════════════════════════

-- Locataire : créer et lire ses propres incidents
create policy "incidents_locataire_insert" on public.incidents
  for insert
  with check (signale_par = auth.uid());

create policy "incidents_locataire_select" on public.incidents
  for select
  using (signale_par = auth.uid());

create policy "incidents_locataire_update" on public.incidents
  for update
  using (signale_par = auth.uid())
  with check (signale_par = auth.uid());

-- Propriétaire : CRUD complet sur les incidents de ses biens
create policy "incidents_proprietaire_all" on public.incidents
  for all
  using (
    bien_id in (
      select id from public.biens
      where proprietaire_id = auth.uid()
    )
  )
  with check (
    bien_id in (
      select id from public.biens
      where proprietaire_id = auth.uid()
    )
  );


-- ════════════════════════════════════════════════════════════
-- 8. MEDIAS
-- Problème : la sous-requête imbriquée est correcte mais
-- INSERT manque d'un "with check".
-- ════════════════════════════════════════════════════════════

-- Lecture : incident accessible par l'utilisateur
create policy "medias_select" on public.medias
  for select
  using (
    incident_id in (
      select id from public.incidents
      where signale_par = auth.uid()
        or bien_id in (
          select id from public.biens
          where proprietaire_id = auth.uid()
        )
    )
  );

-- Upload : uniquement sur ses propres incidents
create policy "medias_insert" on public.medias
  for insert
  with check (
    uploaded_by = auth.uid()
    and incident_id in (
      select id from public.incidents
      where signale_par = auth.uid()
        or bien_id in (
          select id from public.biens
          where proprietaire_id = auth.uid()
        )
    )
  );

-- Suppression : uniquement ses propres médias
create policy "medias_delete" on public.medias
  for delete
  using (uploaded_by = auth.uid());


-- ════════════════════════════════════════════════════════════
-- 9. DOCUMENTS
-- Problème : "for all using (uploaded_by = auth.uid())"
-- empêche le locataire d'INSÉRER son propre document
-- (uploaded_by = auth.uid() est vrai mais "using" ne
-- couvre pas les INSERT sans "with check").
-- ════════════════════════════════════════════════════════════

-- Propriétaire/gestionnaire : CRUD sur ses documents uploadés
create policy "documents_uploader_all" on public.documents
  for all
  using (uploaded_by = auth.uid())
  with check (uploaded_by = auth.uid());

-- Locataire : lecture des documents de son bien
create policy "documents_locataire_select" on public.documents
  for select
  using (
    bien_id in (
      select bien_id from public.locations
      where locataire_id = auth.uid()
        and statut = 'actif'
    )
  );

-- Locataire : upload de ses propres documents
create policy "documents_locataire_insert" on public.documents
  for insert
  with check (
    uploaded_by = auth.uid()
    and bien_id in (
      select bien_id from public.locations
      where locataire_id = auth.uid()
        and statut = 'actif'
    )
  );


-- ════════════════════════════════════════════════════════════
-- 10. MESSAGES
-- Problème : "for all using" ne couvre pas les INSERT.
-- Un utilisateur doit pouvoir envoyer un message à quelqu'un
-- d'autre → "with check" sur l'expéditeur uniquement.
-- ════════════════════════════════════════════════════════════

-- Lecture : expéditeur ou destinataire
create policy "messages_select" on public.messages
  for select
  using (expediteur = auth.uid() or destinataire = auth.uid());

-- Envoi : l'expéditeur doit être l'utilisateur connecté
create policy "messages_insert" on public.messages
  for insert
  with check (expediteur = auth.uid());

-- Mise à jour : marquer comme lu (destinataire uniquement)
create policy "messages_update_lu" on public.messages
  for update
  using (destinataire = auth.uid())
  with check (destinataire = auth.uid());


-- ════════════════════════════════════════════════════════════
-- 11. PRESTATAIRES
-- Manquant totalement dans le schéma original !
-- ════════════════════════════════════════════════════════════

-- Propriétaire/gestionnaire : CRUD sur ses prestataires
create policy "prestataires_proprietaire_all" on public.prestataires
  for all
  using (
    profile_id = auth.uid()
    or auth.uid() in (
      select id from public.profiles
      where role in ('proprietaire','gestionnaire')
    )
  )
  with check (
    auth.uid() in (
      select id from public.profiles
      where role in ('proprietaire','gestionnaire')
    )
  );

-- Lecture par tous les utilisateurs authentifiés (pour assignation)
create policy "prestataires_select_all" on public.prestataires
  for select
  using (auth.uid() is not null);


-- ════════════════════════════════════════════════════════════
-- 12. AUDIT LOG
-- Manquant totalement dans le schéma original !
-- ════════════════════════════════════════════════════════════

-- Tout utilisateur peut créer des entrées de log
create policy "audit_log_insert" on public.audit_log
  for insert
  with check (user_id = auth.uid());

-- Lecture : uniquement les logs liés à ses propres actions
-- ou aux biens qu'il possède
create policy "audit_log_select" on public.audit_log
  for select
  using (
    user_id = auth.uid()
    or record_id in (
      select id from public.incidents
      where bien_id in (
        select id from public.biens
        where proprietaire_id = auth.uid()
      )
    )
  );


-- ════════════════════════════════════════════════════════════
-- 13. STORAGE — Politiques sur les buckets
-- À exécuter aussi (Storage → Policies dans Supabase)
-- ════════════════════════════════════════════════════════════

-- Bucket "medias" : upload par utilisateurs authentifiés
insert into storage.buckets (id, name, public, file_size_limit)
values ('medias', 'medias', false, 104857600)  -- 100 Mo
on conflict (id) do update set file_size_limit = excluded.file_size_limit;

-- Bucket "documents" : upload par utilisateurs authentifiés
insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 52428800)  -- 50 Mo
on conflict (id) do update set file_size_limit = excluded.file_size_limit;

-- Bucket "avatars" : public
insert into storage.buckets (id, name, public, file_size_limit)
values ('avatars', 'avatars', true, 2097152)  -- 2 Mo
on conflict (id) do update set file_size_limit = excluded.file_size_limit;

-- Politiques storage : upload autorisé pour tout utilisateur connecté
drop policy if exists "medias_upload"    on storage.objects;
drop policy if exists "medias_read"      on storage.objects;
drop policy if exists "documents_upload" on storage.objects;
drop policy if exists "documents_read"   on storage.objects;
drop policy if exists "avatars_upload"   on storage.objects;

create policy "medias_upload" on storage.objects
  for insert with check (
    bucket_id = 'medias' and auth.uid() is not null
  );

create policy "medias_read" on storage.objects
  for select using (
    bucket_id = 'medias' and auth.uid() is not null
  );

create policy "documents_upload" on storage.objects
  for insert with check (
    bucket_id = 'documents' and auth.uid() is not null
  );

create policy "documents_read" on storage.objects
  for select using (
    bucket_id = 'documents' and auth.uid() is not null
  );

create policy "avatars_all" on storage.objects
  for all using (bucket_id = 'avatars')
  with check (bucket_id = 'avatars');

-- ════════════════════════════════════════════════════════════
-- FIN DU SCRIPT — Vérification
-- ════════════════════════════════════════════════════════════
-- Après exécution, vérifiez dans :
-- Supabase → Authentication → Policies
-- Vous devez voir les politiques listées pour chaque table.
-- ════════════════════════════════════════════════════════════
