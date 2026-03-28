import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('ImmoTrack crash:', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children

    const msg = this.state.error.message || String(this.state.error)
    const isConfig = msg.includes('supabase') || msg.includes('SUPABASE') || msg.includes('placeholder')

    return (
      <div style={{
        minHeight: '100vh', background: '#F7F5F0',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24, fontFamily: 'sans-serif',
      }}>
        <div style={{
          background: '#fff', borderRadius: 16,
          border: '1px solid rgba(0,0,0,0.08)',
          padding: '36px 32px', maxWidth: 520, width: '100%',
          boxShadow: '0 4px 24px rgba(0,0,0,0.07)',
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>
            {isConfig ? '🔑' : '⚠️'}
          </div>
          <h2 style={{
            fontFamily: 'Georgia,serif', fontSize: 20,
            color: '#1A1714', marginBottom: 10,
          }}>
            {isConfig ? 'Variables Supabase manquantes' : 'Une erreur est survenue'}
          </h2>

          {isConfig ? (
            <>
              <p style={{ color: '#6B6560', fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
                L'app ne peut pas se connecter à Supabase. Vérifiez que les variables d'environnement sont bien configurées dans Vercel.
              </p>
              <div style={{ background: '#1A1714', borderRadius: 8, padding: '14px 16px', marginBottom: 16 }}>
                <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#E8F2EB', lineHeight: 1.8 }}>
                  <div style={{ color: '#9E9890' }}># Vercel → Settings → Environment Variables</div>
                  <div><span style={{ color: '#C8813A' }}>REACT_APP_SUPABASE_URL</span> = https://xxxx.supabase.co</div>
                  <div><span style={{ color: '#C8813A' }}>REACT_APP_SUPABASE_ANON_KEY</span> = eyJhbG...</div>
                </div>
              </div>
              <p style={{ color: '#6B6560', fontSize: 13, lineHeight: 1.6 }}>
                Après les avoir ajoutées : <strong>Vercel → Deployments → Redeploy</strong>
              </p>
            </>
          ) : (
            <>
              <p style={{ color: '#6B6560', fontSize: 14, lineHeight: 1.6, marginBottom: 12 }}>
                Un problème inattendu s'est produit. Détail technique :
              </p>
              <div style={{ background: '#FDEAEA', borderRadius: 8, padding: '10px 14px',
                            fontFamily: 'monospace', fontSize: 12, color: '#B83232',
                            wordBreak: 'break-all', marginBottom: 16 }}>
                {msg}
              </div>
              <button onClick={() => window.location.reload()} style={{
                padding: '9px 18px', background: '#2D5A3D', color: '#fff',
                border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13,
              }}>
                Recharger la page
              </button>
            </>
          )}
        </div>
      </div>
    )
  }
}
