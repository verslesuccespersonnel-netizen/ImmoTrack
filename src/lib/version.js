export const VERSION = '2.3.0'
export const BUILD_DATE = '2025-07-07'

export const CHANGELOG = [
  {
    version: '2.3.0', date: '2025-07-07', label: 'Biens et Locataires stabilises',
    changes: [
      { type:'fix',  text:'Locataires sans compte desormais visibles dans la liste' },
      { type:'fix',  text:'Biens : nom du locataire affiche meme sans profil ImmoTrack' },
      { type:'new',  text:'Biens : creation de locataire inline depuis la fiche bien' },
      { type:'new',  text:'Biens : fiche expandable avec toutes les infos et historique' },
      { type:'new',  text:'Biens : un seul bouton Locataire (suppression doublon)' },
      { type:'new',  text:'Quittances : generation automatique avec notification locataire' },
      { type:'fix',  text:'Suppression bien : cascade correcte sur FK' },
      { type:'fix',  text:'Admin : messages clairs sur les limitations de suppression auth' },
    ]
  },
  {
    version: '2.2.0', date: '2025-07-06', label: 'Stabilisation complete',
    changes: [
      { type:'fix',  text:'Chargement infini : reload au retour sur onglet (30s seuil)' },
      { type:'fix',  text:'Resize plan 2D : window.mousemove, aucun conflit pointer' },
      { type:'new',  text:'Plan 2D : indicateur resize visible sur pieces selectionnees' },
      { type:'new',  text:'Toutes les pages utilisent useCallback + load direct' },
      { type:'new',  text:'Locataires : section comptes sans logement attribue' },
    ]
  },
  {
    version: '2.1.0', date: '2025-07-05', label: 'Ergonomie et corrections',
    changes: [
      { type:'fix',  text:'Login sans refresh de page' },
      { type:'new',  text:'4 roles : locataire, proprietaire, agence, admin' },
      { type:'new',  text:'Messagerie temps reel' },
      { type:'new',  text:'Prestataires 14 specialites predefinies' },
    ]
  },
  {
    version: '2.0.0', date: '2025-07-04', label: 'Reecriture complete v2',
    changes: [
      { type:'new',  text:'Architecture AuthContext sans race condition' },
      { type:'new',  text:'Responsive mobile : sidebar + hamburger + bottom nav' },
      { type:'new',  text:'Plan 2D interactif multi-niveaux avec equipements' },
      { type:'new',  text:'Catalogue 200+ types de pannes' },
    ]
  },
]
