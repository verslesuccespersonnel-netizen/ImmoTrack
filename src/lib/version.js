// src/lib/version.js — Changelog centralisé
// À mettre à jour à chaque déploiement

export const APP_VERSION = '1.5.0'
export const APP_DATE = '2025-07-02'

export const CHANGELOG = [
  {
    version: '1.5.0',
    date: '2025-07-02',
    label: 'Locataires & Plan v2',
    changes: [
      { type: 'new',  text: 'Page Locataires dédiée dans le menu (sous Mes biens)' },
      { type: 'new',  text: 'Création locataire : contrat, loyer, dates, occupants, garants' },
      { type: 'new',  text: 'Garants : lien, type de caution (Visale, bancaire…), montant' },
      { type: 'new',  text: 'Plan 2D : zone de dessin doublée (28×20 cellules)' },
      { type: 'new',  text: 'Plan 2D : pièce personnalisée, escalier, débarras, dépendance' },
      { type: 'new',  text: 'Plan 2D : niveaux Jardin, Cour, Patio, Garage + niveau personnalisé' },
      { type: 'fix',  text: 'Plan 2D : navigation retour ne déconnecte plus' },
      { type: 'fix',  text: 'Inactivité : bouton déconnexion visible après 3s de chargement' },
      { type: 'fix',  text: 'Création locataire : bug de sauvegarde corrigé' },
    ]
  },
  {
    version: '1.4.0',
    date: '2025-07-01',
    label: 'Admin complet & Correctifs critiques',
    changes: [
      { type: 'new',  text: 'Admin : création locataire sans compte préalable (invitation)' },
      { type: 'new',  text: 'Admin : garants / cautions (nom, lien, type, montant)' },
      { type: 'new',  text: 'Admin : profils enrichis (2 téléphones, société, adresse, notes)' },
      { type: 'new',  text: 'Admin : types de contrat (bail vide/meublé/commercial/colocation…)' },
      { type: 'new',  text: 'Propriétaire peut déclarer des incidents depuis son interface' },
      { type: 'fix',  text: 'Plan 2D : navigation corrigée (ne déconnecte plus)' },
      { type: 'fix',  text: 'Inactivité : refresh automatique du token de session' },
      { type: 'fix',  text: 'Rôle null au chargement ne redirige plus vers locataire' },
      { type: 'fix',  text: 'Bouton déconnecter fiable en toutes circonstances' },
    ]
  },
  {
    version: '1.3.0',
    date: '2025-06-30',
    label: 'Catalogue & Plan interactif',
    changes: [
      { type: 'new',  text: 'Constructeur de plan 2D interactif (glisser-déposer, multi-étages)' },
      { type: 'new',  text: 'Catalogue complet : 26 types de pièces, 80 équipements, 200 pannes' },
      { type: 'new',  text: 'Page Administration : gestion comptes, rôles, biens, incidents' },
      { type: 'new',  text: 'Page Catalogue : zones → pièces → équipements → pannes éditable' },
      { type: 'new',  text: 'Mode démonstration guidé par rôle' },
      { type: 'new',  text: 'Numéro de version et changelog' },
      { type: 'fix',  text: 'Correction récursion infinie RLS (biens ↔ locations)' },
      { type: 'fix',  text: 'Correction rôle proprietaire toujours affiché locataire' },
      { type: 'fix',  text: 'Déconnexion fiable (vidage localStorage Supabase)' },
    ]
  },
  {
    version: '1.2.0',
    date: '2025-06-20',
    label: 'Biens & Prestataires',
    changes: [
      { type: 'new',  text: 'Page Mes biens : création, modification, pièces, éléments, locataire' },
      { type: 'new',  text: 'Page Prestataires : annuaire avec spécialités et notation' },
      { type: 'new',  text: 'Menus différenciés par rôle (locataire / propriétaire / gestionnaire)' },
      { type: 'fix',  text: 'Correction spinner infini au chargement' },
      { type: 'fix',  text: 'Correction politiques RLS sur toutes les tables' },
    ]
  },
  {
    version: '1.1.0',
    date: '2025-06-10',
    label: 'Auth & Base de données',
    changes: [
      { type: 'new',  text: 'Trigger automatique de création de profil à l\'inscription' },
      { type: 'new',  text: 'Correction bug rôle majuscule/minuscule' },
      { type: 'new',  text: 'Script RLS complet pour toutes les tables' },
      { type: 'fix',  text: 'Correction "email rate limit exceeded" (désactivation confirmation)' },
      { type: 'fix',  text: 'Correction foreign key constraint profiles → biens' },
    ]
  },
  {
    version: '1.0.0',
    date: '2025-06-01',
    label: 'Lancement initial',
    changes: [
      { type: 'new',  text: 'Dashboard locataire et propriétaire' },
      { type: 'new',  text: 'Signalement d\'incident avec upload de médias' },
      { type: 'new',  text: 'Espace documents avec partage par lien' },
      { type: 'new',  text: 'Messagerie en temps réel' },
      { type: 'new',  text: 'Déploiement Vercel + Supabase' },
    ]
  },
]
