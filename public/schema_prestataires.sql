-- Ajouter colonnes manquantes à la table prestataires
alter table public.prestataires
  add column if not exists telephone2    text,
  add column if not exists site_web      text,
  add column if not exists ville         text,
  add column if not exists siret         text,
  add column if not exists assurance     text,
  add column if not exists tarif_horaire numeric,
  add column if not exists disponibilite text,
  add column if not exists cree_par      uuid references public.profiles(id) on delete set null;

-- Table de liaison prestataire <-> bien
create table if not exists public.prestataire_biens (
  id             uuid default gen_random_uuid() primary key,
  prestataire_id uuid references public.prestataires(id) on delete cascade,
  bien_id        uuid references public.biens(id) on delete cascade,
  created_at     timestamptz default now(),
  unique(prestataire_id, bien_id)
);

alter table public.prestataire_biens enable row level security;
create policy "prestataire_biens_all" on public.prestataire_biens
  for all to authenticated using (true);

-- RLS prestataires : lisibles par tous les authentifiés
drop policy if exists "prestataires_all" on public.prestataires;
create policy "prestataires_read" on public.prestataires
  for select to authenticated using (true);
create policy "prestataires_write" on public.prestataires
  for all to authenticated
  using (cree_par = auth.uid() or cree_par is null)
  with check (cree_par = auth.uid());

select 'Schema prestataires OK' as status;
