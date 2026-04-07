export const VERSION = '2.2.0'
export const BUILD_DATE = '2025-07-06'
export const CHANGELOG = [
  { version:'2.2.0', date:'2025-07-06', label:'Stabilisation complète',
    changes:[
      {type:'fix', text:'Chargement infini : reload immédiat au retour sur un onglet'},
      {type:'fix', text:'Resize pièces plan 2D : setState fonctionnel, aucune closure stale'},
      {type:'new', text:'Toutes les pages utilisent useLoad (AbortController + timeout 8s)'},
      {type:'new', text:'Administration : suppression sélective et export JSON'},
      {type:'new', text:'Locataires : archivage et suppression définitive'},
      {type:'new', text:'Biens : attribution locataire directe'},
    ]
  },
  { version:'2.1.0', date:'2025-07-05', label:'Ergonomie & Corrections',
    changes:[
      {type:'fix', text:'Login sans refresh de page'},
      {type:'new', text:'4 rôles : locataire, propriétaire, agence, admin'},
      {type:'new', text:'Prestataires avec 14 spécialités prédéfinies'},
      {type:'new', text:'Messagerie temps réel'},
    ]
  },
  { version:'2.0.0', date:'2025-07-04', label:'Réécriture complète',
    changes:[
      {type:'new', text:'Architecture sans race condition'},
      {type:'new', text:'Responsive mobile complet'},
      {type:'new', text:'Plan 2D interactif multi-niveaux'},
    ]
  },
]
