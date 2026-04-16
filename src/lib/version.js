export const VERSION = '2.4.0'
export const BUILD_DATE = '2025-07-08'

export const CHANGELOG = [
  {
    version: '2.4.0', date: '2025-07-08', label: 'Gestion complète des comptes',
    changes: [
      { type:'new',  text:'Admin : créer des comptes directement (all roles) avec mot de passe provisoire' },
      { type:'new',  text:'Admin : inviter par email avec rôle et bien optionnel' },
      { type:'new',  text:'Admin : onglet Associations — assigner locataire→bien, proprio→agence' },
      { type:'new',  text:'Admin : email visible dans Modifier, cascade suppression corrigée' },
      { type:'new',  text:'Connexion : récupération de mot de passe oublié par email' },
      { type:'new',  text:'Tchat communautaire : groupes par immeuble, temps réel, épinglage' },
      { type:'fix',  text:'CSS global.css : classes réalignées avec Layout.jsx' },
      { type:'fix',  text:'useLoad : retente automatiquement dès que l\'auth est prête' },
      { type:'fix',  text:'Dashboard : biens admin chargés correctement' },
    ]
  },
  {
    version: '2.3.0', date: '2025-07-07', label: 'Biens et Locataires enrichis',
    changes: [
      { type:'fix',  text:'Locataires sans compte visibles dans la liste' },
      { type:'new',  text:'Biens : création locataire inline, fiche expandable avec historique' },
      { type:'new',  text:'Quittances : génération automatique avec notification' },
    ]
  },
  {
    version: '2.2.0', date: '2025-07-06', label: 'Stabilisation',
    changes: [
      { type:'fix',  text:'Resize plan 2D : window.mousemove sans conflit' },
      { type:'fix',  text:'Chargement infini résolu (bfcache + visibilitychange)' },
    ]
  },
  {
    version: '2.0.0', date: '2025-07-04', label: 'Réécriture complète',
    changes: [
      { type:'new',  text:'React 18 + Supabase v2 + Vercel' },
      { type:'new',  text:'Plan 2D SVG drag+resize multi-niveaux' },
      { type:'new',  text:'Catalogue 200+ équipements et pannes' },
    ]
  },
]
