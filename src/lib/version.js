export const VERSION = '2.1.0'
export const BUILD_DATE = '2025-07-05'

export const CHANGELOG = [
  {
    version: '2.1.0', date: '2025-07-05', label: 'Ergonomie & Corrections majeures',
    changes: [
      { type:'fix',  text:'Login : connexion immédiate sans besoin de rafraîchir la page' },
      { type:'fix',  text:'Admin : accès refusé pour le rôle "admin" corrigé' },
      { type:'fix',  text:'Menus Biens/Locataires/Admin ne renvoyaient plus au tableau de bord' },
      { type:'fix',  text:'Messages : conversations chargées correctement avec statut lu/non-lu' },
      { type:'new',  text:'Biens : attribution directe d\'un locataire depuis la fiche du bien' },
      { type:'new',  text:'Biens : clic sur le nom du locataire → fiche locataire' },
      { type:'new',  text:'Biens : locataires disponibles affichés en priorité dans le sélecteur' },
      { type:'new',  text:'Documents : upload de fichiers vers Supabase Storage' },
      { type:'new',  text:'Messages : affichage temps réel, statut lu (✓✓), nouvelle conversation' },
      { type:'new',  text:'Tableau de bord : graphique incidents 6 mois, donut taux occupation' },
      { type:'new',  text:'Recherche globale Cmd+K sur le tableau de bord' },
      { type:'new',  text:'4 rôles : locataire, propriétaire, agence, admin (+ prestataire)' },
    ]
  },
  {
    version: '2.0.0', date: '2025-07-04', label: 'Réécriture complète',
    changes: [
      { type:'new',  text:'Architecture sans race condition (getSession + onAuthStateChange minimal)' },
      { type:'fix',  text:'Fix bfcache : pageshow persisted → reload automatique (fin du bug d\'onglet)' },
      { type:'new',  text:'Responsive complet avec vraies media queries CSS' },
      { type:'new',  text:'Navigation mobile : hamburger + sidebar + bottom nav' },
      { type:'new',  text:'Plan 2D interactif avec pièces et équipements glissables' },
      { type:'new',  text:'Catalogue : 200+ types de pannes pour maisons et locaux' },
      { type:'new',  text:'Locataires : gestion contrats, occupants, garants' },
    ]
  },
]
