export const VERSION = '2.0.0'
export const BUILD_DATE = '2025-07-04'

export const CHANGELOG = [
  {
    version: '2.0.0', date: '2025-07-04', label: 'Réécriture complète',
    changes: [
      { type:'new', text:'Architecture sans race condition (getSession + onAuthStateChange minimal)' },
      { type:'new', text:'Fix bfcache : pageshow persisted → reload automatique' },
      { type:'new', text:'Responsive complet avec vraies media queries CSS' },
      { type:'new', text:'Navigation mobile : hamburger + sidebar + bottom nav' },
      { type:'new', text:'Toutes les fonctionnalités v1 préservées' },
    ]
  }
]
