-- Copier les emails de auth.users vers public.profiles
-- À exécuter dans Supabase SQL Editor

-- 1. Ajouter colonne email si manquante
alter table public.profiles 
  add column if not exists email text;

-- 2. Copier les emails existants
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id
and (p.email is null or p.email = '');

-- 3. Mettre à jour le trigger pour inclure l'email
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, nom, prenom, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nom', ''),
    coalesce(new.raw_user_meta_data->>'prenom', ''),
    coalesce(new.raw_user_meta_data->>'role', 'locataire')
  )
  on conflict (id) do update set
    email  = excluded.email,
    nom    = case when excluded.nom != '' then excluded.nom else profiles.nom end,
    prenom = case when excluded.prenom != '' then excluded.prenom else profiles.prenom end;
  return new;
end;
$$ language plpgsql security definer;

select 'Fix profiles email OK' as status;
