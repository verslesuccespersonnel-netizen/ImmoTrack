-- ============================================================
-- IMMOTRACK — Données de démonstration
-- 
-- AVANT D'EXÉCUTER :
-- Remplacez VOTRE_USER_ID par votre vrai UUID Supabase.
-- Trouvez-le dans : Supabase → Authentication → Users → 
--                   cliquez sur votre email → copiez l'UUID
--
-- Exécutez dans : Supabase → SQL Editor → New query → Run
-- ============================================================

-- Remplacez cette valeur par votre UUID :
do $$
declare
  owner_id uuid := 'VOTRE_USER_ID';   -- ← MODIFIEZ ICI

  bien1_id uuid := gen_random_uuid();
  bien2_id uuid := gen_random_uuid();
  loc1_id  uuid := gen_random_uuid();
  loc2_id  uuid := gen_random_uuid();
  piece1_id uuid := gen_random_uuid();
  piece2_id uuid := gen_random_uuid();
  piece3_id uuid := gen_random_uuid();
  piece4_id uuid := gen_random_uuid();
  piece5_id uuid := gen_random_uuid();
  el1_id uuid := gen_random_uuid();
  el2_id uuid := gen_random_uuid();
  el3_id uuid := gen_random_uuid();
  inc1_id uuid := gen_random_uuid();
  inc2_id uuid := gen_random_uuid();
  inc3_id uuid := gen_random_uuid();
  presta1_id uuid := gen_random_uuid();

begin

  -- ── BIENS ────────────────────────────────────────────────
  insert into public.biens (id, proprietaire_id, adresse, ville, code_postal, type_bien, surface_m2)
  values
    (bien1_id, owner_id, '12 rue des Acacias', 'Paris', '75015', 'Appartement T3', 68),
    (bien2_id, owner_id, '5 avenue Foch', 'Lyon', '69006', 'Appartement T2', 45);

  -- ── LOCATIONS ────────────────────────────────────────────
  -- (Sans locataire pour l'instant — à associer quand vos locataires créent leur compte)
  insert into public.locations (id, bien_id, loyer_mensuel, date_debut, statut)
  values
    (loc1_id, bien1_id, 1350, '2024-01-15', 'actif'),
    (loc2_id, bien2_id, 920,  '2024-03-01', 'actif');

  -- ── PIÈCES — Bien 1 ──────────────────────────────────────
  insert into public.pieces (id, bien_id, nom, ordre)
  values
    (piece1_id, bien1_id, 'Cuisine',       1),
    (piece2_id, bien1_id, 'Salon',         2),
    (piece3_id, bien1_id, 'Chambre 1',     3),
    (piece4_id, bien1_id, 'Salle de bain', 4),
    (piece5_id, bien1_id, 'Couloir',       5);

  -- ── ÉLÉMENTS ─────────────────────────────────────────────
  insert into public.elements (id, piece_id, nom, type)
  values
    (el1_id, piece1_id, 'Robinet évier', 'plomberie'),
    (el2_id, piece3_id, 'Volet roulant', 'menuiserie'),
    (el3_id, piece5_id, 'Chaudière',     'chauffage');

  -- ── INCIDENTS ────────────────────────────────────────────
  insert into public.incidents (id, bien_id, piece_id, element_id, signale_par,
    titre, description, categorie, gravite, statut)
  values
    (inc1_id, bien1_id, piece1_id, el1_id, owner_id,
     'Fuite robinet cuisine',
     'Écoulement lent au niveau du siphon. Présence d''humidité sous le meuble. Joint usé.',
     'plomberie', 'urgent', 'en_cours'),

    (inc2_id, bien1_id, piece3_id, el2_id, owner_id,
     'Volet roulant bloqué',
     'Le volet ne remonte plus depuis lundi. Bruit inhabituel au démarrage du moteur.',
     'menuiserie', 'moyen', 'nouveau'),

    (inc3_id, bien1_id, piece5_id, el3_id, owner_id,
     'Chaudière bruyante',
     'Bruit de claquement au démarrage. Résolu après intervention.',
     'chauffage', 'moyen', 'resolu');

  -- ── PRESTATAIRES ─────────────────────────────────────────
  insert into public.prestataires (id, nom_entreprise, specialite, telephone, email, note_moyenne, nb_missions)
  values
    (presta1_id, 'Plomberie Martin & Fils', 'plomberie', '06 12 34 56 78', 'martin@plomberie.fr', 4.8, 12),
    (gen_random_uuid(), 'Électricité Dubois', 'electricite', '06 23 45 67 89', 'dubois@elec.fr', 4.5, 8),
    (gen_random_uuid(), 'Chauffage Pro SAS', 'chauffage', '06 34 56 78 90', 'contact@chauffagepro.fr', 4.7, 6),
    (gen_random_uuid(), 'Menuiserie Arnoux', 'menuiserie', '06 45 67 89 01', 'arnoux@menuiserie.fr', 4.3, 4);

  -- ── AUDIT LOG ────────────────────────────────────────────
  insert into public.audit_log (table_name, record_id, action, user_id, details)
  values
    ('incidents', inc1_id, 'create', owner_id, '{"titre": "Fuite robinet cuisine"}'),
    ('incidents', inc2_id, 'create', owner_id, '{"titre": "Volet roulant bloqué"}'),
    ('incidents', inc3_id, 'create', owner_id, '{"titre": "Chaudière bruyante"}'),
    ('incidents', inc3_id, 'update', owner_id, '{"statut": "resolu"}');

  raise notice 'Données de démo insérées avec succès !';

end $$;
