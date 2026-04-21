export const VERSION = '2.5.0'
export const BUILD_DATE = '2025-07-09'

export const CHANGELOG = [
  {
    version: '2.5.0', date: '2025-07-09', label: 'Sécurité et navigation',
    changes: [
      { type:'new',  text:'Page Profil : changer son mot de passe et ses informations' },
      { type:'fix',  text:'Réinitialisation mot de passe : page sécurisée avant connexion' },
      { type:'fix',  text:'Navigation : pages rechargées automatiquement à chaque changement de menu' },
      { type:'new',  text:'Dashboard locataire : plan du logement accessible directement' },
      { type:'new',  text:'Plan 2D : locataires peuvent déclarer incidents sur pièces et équipements' },
      { type:'fix',  text:'Plan 2D : drag et resize fonctionnels (draggedRef fix)' },
      { type:'fix',  text:'Quittances : erreur .catch() corrigée, envoi au locataire fonctionnel' },
    ]
  },
  {
    version: '2.4.0', date: '2025-07-08', label: 'Gestion complète des comptes',
    changes: [
      { type:'new',  text:'Admin : créer comptes directement, inviter par email' },
      { type:'new',  text:'Admin : associations locataire→bien, proprio→agence' },
      { type:'new',  text:'Connexion : récupération mot de passe par email' },
      { type:'new',  text:'Tchat communautaire : groupes, temps réel, épinglage' },
      { type:'fix',  text:'CSS : classes réalignées avec Layout.jsx' },
    ]
  },
  {
    version: '2.3.0', date: '2025-07-07', label: 'Biens et Locataires enrichis',
    changes: [
      { type:'new',  text:'Biens : fiche expandable avec historique locations' },
      { type:'new',  text:'Quittances : génération HTML, archivage, notification locataire' },
      { type:'fix',  text:'Locataires sans compte visibles dans la liste' },
    ]
  },
  {
    version: '2.0.0', date: '2025-07-04', label: 'Réécriture complète',
    changes: [
      { type:'new',  text:'React 18 + Supabase v2 + Vercel' },
      { type:'new',  text:'Plan 2D SVG drag+resize multi-niveaux' },
      { type:'new',  text:'Catalogue 200+ équipements et pannes' },
      { type:'new',  text:'4 rôles : locataire, propriétaire, agence, admin' },
    ]
  },
]
