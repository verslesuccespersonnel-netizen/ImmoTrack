import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

// ── Composant mini-graphique barre ───────────────────────
function BarChart({ data, height = 80 }) {
  if (!data || data.length === 0) return null
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:4, height, marginTop:8 }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
          <div style={{ fontSize:9, color:'#9E9890', fontWeight:500 }}>
            {d.value > 0 ? d.value.toLocaleString('fr-FR') : ''}
          </div>
          <div style={{ width:'100%', borderRadius:'3px 3px 0 0', background: d.color || '#2D5A3D', opacity: 0.8 + (i/data.length)*0.2, transition:'height .3s', height: `${Math.max(4, (d.value/max)*100)}%` }}/>
          <div style={{ fontSize:9, color:'#9E9890', textAlign:'center', whiteSpace:'nowrap' }}>{d.label}</div>
        </div>
      ))}
    </div>
  )
}

// ── Composant donut simple ───────────────────────────────
function Donut({ pct, color = '#2D5A3D', size = 64, label }) {
  const r = 24, c = 2 * Math.PI * r
  const dash = (pct / 100) * c
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
      <svg width={size} height={size} viewBox="0 0 56 56">
        <circle cx="28" cy="28" r={r} fill="none" stroke="#F0EDE6" strokeWidth="6"/>
        <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={`${dash} ${c}`} strokeLinecap="round"
          transform="rotate(-90 28 28)" style={{ transition:'stroke-dasharray .5s' }}/>
        <text x="28" y="32" textAnchor="middle" fontSize="11" fontWeight="700" fill={color}>{pct}%</text>
      </svg>
      {label && <div style={{ fontSize:11, color:'#6B6560', textAlign:'center' }}>{label}</div>}
    </div>
  )
}

// ── Recherche globale ────────────────────────────────────
function GlobalSearch({ onClose }) {
  const { session, profile } = useAuth()
  const navigate = useNavigate()
  const [q, setQ]         = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  const search = useCallback(async (query) => {
    if (query.length < 2) { setResults([]); return }
    setLoading(true)
    try {
      const MGR = ['proprietaire','gestionnaire','agence','admin']
      const isOwner = MGR.includes(profile?.role)
      const [incRes, biensRes, locsRes] = await Promise.all([
        supabase.from('incidents').select('id, titre, statut, gravite').ilike('titre', `%${query}%`).limit(5),
        isOwner ? supabase.from('biens').select('id, adresse, ville').or(`adresse.ilike.%${query}%,ville.ilike.%${query}%`).eq('proprietaire_id', session.user.id).limit(5) : Promise.resolve({data:[]}),
        isOwner ? supabase.from('locations').select('id, profiles!locataire_id(id,nom,prenom)').ilike('profiles!locataire_id.nom', `%${query}%`).limit(5) : Promise.resolve({data:[]}),
      ])
      const res = [
        ...(incRes.data||[]).map(i => ({ type:'incident', label: i.titre, sub: i.statut, icon: i.gravite==='urgent'?'🔴':'⚠️', path:'/incidents' })),
        ...(biensRes.data||[]).map(b => ({ type:'bien', label: b.adresse, sub: b.ville, icon:'🏠', path:'/biens' })),
      ].filter(Boolean)
      setResults(res)
    } catch {}
    setLoading(false)
  }, [session, profile])

  useEffect(() => {
    const t = setTimeout(() => search(q), 300)
    return () => clearTimeout(t)
  }, [q, search])

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:500, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'60px 16px 16px' }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background:'#fff', borderRadius:14, width:'100%', maxWidth:520, boxShadow:'0 12px 40px rgba(0,0,0,.2)', overflow:'hidden' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 16px', borderBottom:'1px solid rgba(0,0,0,.07)' }}>
          <span style={{ fontSize:18 }}>🔍</span>
          <input autoFocus value={q} onChange={e => setQ(e.target.value)}
            placeholder="Chercher incidents, biens, locataires…"
            style={{ flex:1, border:'none', outline:'none', fontFamily:'inherit', fontSize:15, background:'transparent' }}
            onKeyDown={e => e.key==='Escape' && onClose()} />
          {loading && <div style={{ width:16, height:16, borderRadius:'50%', border:'2px solid #E8F2EB', borderTopColor:'#2D5A3D', animation:'spin .6s linear infinite' }}/>}
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:18, color:'#9E9890' }}>✕</button>
        </div>
        {results.length > 0 && (
          <div>
            {results.map((r, i) => (
              <div key={i} onClick={() => { navigate(r.path); onClose() }}
                style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 16px', cursor:'pointer', borderBottom:'1px solid rgba(0,0,0,.04)' }}
                onMouseEnter={e => e.currentTarget.style.background='#F7F5F0'}
                onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                <span style={{ fontSize:18, width:24, textAlign:'center' }}>{r.icon}</span>
                <div>
                  <div style={{ fontSize:13, fontWeight:500 }}>{r.label}</div>
                  <div style={{ fontSize:11, color:'#9E9890' }}>{r.type} · {r.sub}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        {q.length >= 2 && results.length === 0 && !loading && (
          <div style={{ padding:'20px 16px', textAlign:'center', color:'#9E9890', fontSize:13 }}>Aucun résultat pour "{q}"</div>
        )}
        {q.length < 2 && (
          <div style={{ padding:'12px 16px 14px' }}>
            <div style={{ fontSize:11, color:'#9E9890', marginBottom:8 }}>Suggestions</div>
            {['Tapez un titre d\'incident','Adresse d\'un bien','Nom d\'un locataire'].map(s => (
              <div key={s} style={{ fontSize:12, color:'#6B6560', padding:'4px 0' }}>→ {s}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Dashboard principal ──────────────────────────────────
export default function Dashboard() {
  const { profile, session } = useAuth()
  const navigate = useNavigate()
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [showSearch, setShowSearch] = useState(false)

  // Raccourci clavier Cmd/Ctrl+K
  useEffect(() => {
    function h(e) { if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setShowSearch(true) } }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  useEffect(() => {
    if (!session?.user || !profile) return
    let cancelled = false
    async function load() {
      try {
        const MGR = ['proprietaire','gestionnaire','agence','admin']
        let result
        if (profile.role === 'locataire') {
          result = await loadLocataire(session.user.id)
        } else if (MGR.includes(profile.role)) {
          result = await loadOwner(session.user.id)
        } else {
          result = { role: profile.role, incidents:[], messages:0 }
        }
        if (!cancelled) { setData(result); setError(null) }
      } catch(e) {
        if (!cancelled) setError(e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [session?.user?.id, profile?.role])

  if (loading) return <Layout><div className="it-center"><div className="it-spinner"/></div></Layout>
  if (error)   return (
    <Layout>
      <div className="it-center">
        <div style={{ maxWidth:320, textAlign:'center' }}>
          <div style={{ fontSize:32, marginBottom:8 }}>⚠️</div>
          <div style={{ color:'#B83232', fontSize:13, marginBottom:12 }}>{error}</div>
          <button className="btn btn-secondary" onClick={() => window.location.reload()}>↺ Réessayer</button>
        </div>
      </div>
    </Layout>
  )

  return (
    <Layout>
      {showSearch && <GlobalSearch onClose={() => setShowSearch(false)} />}

      {/* Barre de recherche rapide */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:22, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontFamily:'Georgia,serif', fontSize:24, fontWeight:500, color:'#1A1714', margin:0 }}>
            {profile?.role === 'locataire' ? `Bonjour, ${profile?.prenom} 👋` : 'Tableau de bord'}
          </h1>
          <p style={{ fontSize:13, color:'#6B6560', margin:'3px 0 0' }}>
            {profile?.role === 'locataire'
              ? (data?.bien ? `${data.bien.adresse}, ${data.bien.ville}` : 'Bienvenue')
              : `${profile?.prenom} ${profile?.nom} · ${data?.biens?.length||0} bien(s)`}
          </p>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button className="btn btn-secondary" onClick={() => setShowSearch(true)}
            style={{ display:'flex', alignItems:'center', gap:6 }}>
            🔍 Rechercher
            <span style={{ fontSize:10, color:'#9E9890', background:'#F7F5F0', padding:'1px 5px', borderRadius:4 }}>⌘K</span>
          </button>
          {profile?.role === 'locataire'
            ? <button className="btn btn-primary" onClick={() => navigate('/signaler')}>➕ Signaler</button>
            : <button className="btn btn-primary" onClick={() => navigate('/biens')}>🏢 Mes biens</button>
          }
        </div>
      </div>

      {profile?.role === 'locataire'
        ? <LocataireDashboard data={data} navigate={navigate} />
        : <OwnerDashboard data={data} profile={profile} navigate={navigate} />
      }
    </Layout>
  )
}

// ── Dashboard locataire ──────────────────────────────────
function LocataireDashboard({ data, navigate }) {
  const incidents   = data?.incidents || []
  const openCount   = incidents.filter(i => i.statut !== 'resolu').length
  const urgentCount = incidents.filter(i => i.gravite === 'urgent').length
  return (
    <div>
      <div className="grid3" style={{ marginBottom:20 }}>
        <div className="stat-card"><div className="stat-val" style={{ color: urgentCount>0?'#B83232':'inherit' }}>{openCount}</div><div className="stat-label">Incidents ouverts</div><div className="stat-sub">{urgentCount > 0 ? `🔴 ${urgentCount} urgent(s)` : '✅ Aucun urgent'}</div></div>
        <div className="stat-card"><div className="stat-val">{data?.messages||0}</div><div className="stat-label">Messages non lus</div></div>
        <div className="stat-card"><div className="stat-val">{data?.docs||0}</div><div className="stat-label">Documents</div></div>
      </div>
      {incidents.length === 0 ? (
        <div className="card"><div className="card-body" style={{ textAlign:'center', padding:40 }}>
          <div style={{ fontSize:48 }}>🏠</div>
          <h2 style={{ fontFamily:'Georgia,serif', fontSize:18, fontWeight:500, margin:'12px 0 8px' }}>Tout va bien !</h2>
          <p style={{ color:'#6B6560', fontSize:13, marginBottom:16 }}>Aucun incident signalé.</p>
          <button className="btn btn-primary" onClick={() => navigate('/signaler')}>➕ Signaler un problème</button>
        </div></div>
      ) : (
        <div className="card">
          <div className="card-header"><span className="card-title">Mes incidents récents</span><button className="btn btn-secondary btn-sm" onClick={() => navigate('/incidents')}>Voir tout →</button></div>
          {incidents.slice(0,5).map(inc => (
            <div key={inc.id} className="row-item" style={{ cursor:'pointer' }} onClick={() => navigate('/incidents')}>
              <span style={{ fontSize:16 }}>{inc.gravite==='urgent'?'🔴':inc.gravite==='moyen'?'🟡':'🟢'}</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{inc.titre}</div>
                <div style={{ fontSize:11, color:'#9E9890' }}>{new Date(inc.created_at).toLocaleDateString('fr-FR')}</div>
              </div>
              <span className={`status ${inc.statut==='resolu'?'status-green':inc.statut==='en_cours'?'status-yellow':'status-blue'}`}>{inc.statut.replace('_',' ')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Dashboard propriétaire / agence / admin ──────────────
function OwnerDashboard({ data, profile, navigate }) {
  const biens       = data?.biens || []
  const incidents   = data?.incidents || []
  const urgentCount = incidents.filter(i => i.gravite === 'urgent').length
  const totalLoyers = data?.totalLoyers || 0
  const biensOccupes = biens.filter(b => b.locations?.some(l => l.statut==='actif')).length
  const tauxOccup   = biens.length > 0 ? Math.round((biensOccupes/biens.length)*100) : 0
  const loyersPercus = data?.loyersPercus || totalLoyers
  const tauxPerception = totalLoyers > 0 ? Math.round((loyersPercus/totalLoyers)*100) : 0

  // Données graphique mensuel incidents
  const incidentsByMonth = data?.incidentsByMonth || []

  return (
    <div>
      {/* KPI principaux */}
      <div className="grid3" style={{ marginBottom:20 }}>
        <div className="stat-card">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div>
              <div className="stat-val">{biens.length}</div>
              <div className="stat-label">Biens gérés</div>
              <div className="stat-sub">{biensOccupes} occupé(s) · {biens.length-biensOccupes} vacant(s)</div>
            </div>
            <Donut pct={tauxOccup} color="#2D5A3D" label="Occupation" />
          </div>
        </div>
        <div className="stat-card">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div>
              <div className="stat-val" style={{ color: urgentCount>0?'#B83232':'inherit' }}>{incidents.length}</div>
              <div className="stat-label">Incidents ouverts</div>
              <div className="stat-sub">{urgentCount>0 ? `🔴 ${urgentCount} urgent(s)` : '✅ Aucun urgent'}</div>
            </div>
            {urgentCount > 0 && <div style={{ fontSize:36 }}>🔴</div>}
          </div>
        </div>
        <div className="stat-card">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div>
              <div className="stat-val">{totalLoyers > 0 ? `${totalLoyers.toLocaleString('fr-FR')} €` : '—'}</div>
              <div className="stat-label">Loyers / mois</div>
              <div className="stat-sub">{totalLoyers > 0 ? 'Total mensuel théorique' : 'Aucune location active'}</div>
            </div>
            {totalLoyers > 0 && <Donut pct={tauxPerception} color="#C8813A" label="Perçus" />}
          </div>
        </div>
      </div>

      {/* Graphique incidents par mois */}
      {incidentsByMonth.length > 0 && (
        <div className="card" style={{ marginBottom:16 }}>
          <div className="card-header">
            <span className="card-title">📈 Incidents — 6 derniers mois</span>
          </div>
          <div className="card-body">
            <BarChart data={incidentsByMonth} height={100} />
          </div>
        </div>
      )}

      {/* Incidents urgents */}
      {urgentCount > 0 && (
        <div className="card" style={{ marginBottom:16, borderLeft:'3px solid #B83232' }}>
          <div className="card-header">
            <span className="card-title" style={{ color:'#B83232' }}>🔴 Urgents — action requise</span>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/incidents')}>Voir tout →</button>
          </div>
          {incidents.filter(i=>i.gravite==='urgent').map(inc => (
            <div key={inc.id} className="row-item" style={{ cursor:'pointer' }} onClick={() => navigate('/incidents')}>
              <span style={{ fontSize:16 }}>🔴</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{inc.titre}</div>
                <div style={{ fontSize:11, color:'#9E9890' }}>{inc.biens?.adresse} · {new Date(inc.created_at).toLocaleDateString('fr-FR')}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Incidents récents */}
      {biens.length > 0 && (
        <div className="card" style={{ marginBottom:16 }}>
          <div className="card-header">
            <span className="card-title">Incidents récents</span>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/incidents')}>Voir tout →</button>
          </div>
          {incidents.length === 0
            ? <div className="card-body" style={{ textAlign:'center', color:'#9E9890', padding:'24px' }}>✅ Aucun incident ouvert</div>
            : incidents.slice(0,5).map(inc => (
                <div key={inc.id} className="row-item" style={{ cursor:'pointer' }} onClick={() => navigate('/incidents')}>
                  <span style={{ fontSize:16 }}>{inc.gravite==='urgent'?'🔴':inc.gravite==='moyen'?'🟡':'🟢'}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{inc.titre}</div>
                    <div style={{ fontSize:11, color:'#9E9890' }}>{inc.biens?.adresse} · {new Date(inc.created_at).toLocaleDateString('fr-FR')}</div>
                  </div>
                  <span className={`status ${inc.statut==='resolu'?'status-green':inc.statut==='en_cours'?'status-yellow':'status-blue'}`}>{inc.statut.replace('_',' ')}</span>
                </div>
              ))
          }
        </div>
      )}

      {/* Grille biens */}
      {biens.length > 0 && (
        <div>
          <div style={{ fontWeight:600, fontSize:13.5, marginBottom:10 }}>Vos biens</div>
          <div className="grid3">
            {biens.slice(0,5).map(b => {
              const loc = b.locations?.find(l => l.statut==='actif')
              return (
                <div key={b.id} className="card" style={{ cursor:'pointer' }} onClick={() => navigate('/biens')}>
                  <div className="card-body" style={{ padding:'14px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                      <span style={{ fontSize:22 }}>🏠</span>
                      <span className={`status ${loc?'status-green':'status-grey'}`}>{loc?'Occupé':'Vacant'}</span>
                    </div>
                    <div style={{ fontWeight:600, fontSize:13 }}>{b.adresse}</div>
                    <div style={{ fontSize:12, color:'#6B6560' }}>{b.type_bien||'Bien'} · {b.ville}</div>
                    {loc && <div style={{ fontSize:12, color:'#9E9890', marginTop:4 }}>{Number(loc.loyer_mensuel).toLocaleString('fr-FR')} €/mois</div>}
                  </div>
                </div>
              )
            })}
            <div className="card" style={{ cursor:'pointer', border:'2px dashed rgba(0,0,0,.10)' }} onClick={() => navigate('/biens')}>
              <div className="card-body" style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'24px', color:'#9E9890', gap:4 }}>
                <span style={{ fontSize:24 }}>+</span>
                <span style={{ fontSize:12 }}>Ajouter un bien</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {biens.length === 0 && (
        <div className="card"><div className="card-body" style={{ textAlign:'center', padding:40 }}>
          <div style={{ fontSize:48 }}>🏢</div>
          <h2 style={{ fontFamily:'Georgia,serif', fontSize:20, fontWeight:500, margin:'12px 0 8px' }}>Bienvenue !</h2>
          <p style={{ color:'#6B6560', fontSize:13, marginBottom:16 }}>Commencez par ajouter votre premier bien.</p>
          <button className="btn btn-primary" onClick={() => navigate('/biens')}>+ Ajouter un bien</button>
        </div></div>
      )}
    </div>
  )
}

// ── Requêtes données ─────────────────────────────────────
async function loadLocataire(userId) {
  const [{ data: locs }, { data: incs }, { count: msgs }, { count: docs }] = await Promise.all([
    supabase.from('locations').select('biens(id,adresse,ville)').eq('locataire_id', userId).eq('statut','actif').limit(1),
    supabase.from('incidents').select('id,titre,statut,gravite,created_at').eq('signale_par', userId).order('created_at',{ascending:false}).limit(5),
    supabase.from('messages').select('id',{count:'exact',head:true}).eq('destinataire',userId).eq('lu',false),
    supabase.from('documents').select('id',{count:'exact',head:true}),
  ])
  return {
    role: 'locataire',
    bien: locs?.[0]?.biens || null,
    incidents: incs || [],
    messages: msgs || 0,
    docs: docs || 0,
  }
}

async function loadOwner(userId) {
  const { data: biens, error } = await supabase
    .from('biens').select('id,adresse,ville,type_bien, locations(id,statut,loyer_mensuel)')
    .eq('proprietaire_id', userId)
  if (error) throw error

  const bienIds = (biens||[]).map(b => b.id)
  const [{ data: incs }, { count: msgs }] = await Promise.all([
    bienIds.length > 0
      ? supabase.from('incidents').select('id,titre,statut,gravite,created_at,biens(adresse)').in('bien_id',bienIds).neq('statut','resolu').order('created_at',{ascending:false}).limit(10)
      : Promise.resolve({data:[]}),
    supabase.from('messages').select('id',{count:'exact',head:true}).eq('destinataire',userId).eq('lu',false),
  ])

  const totalLoyers = (biens||[]).reduce((s, b) => {
    const loc = b.locations?.find(l => l.statut==='actif')
    return s + (Number(loc?.loyer_mensuel) || 0)
  }, 0)

  // Incidents des 6 derniers mois pour le graphique
  const moisLabels = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    moisLabels.push({ label: d.toLocaleDateString('fr-FR',{month:'short'}), year: d.getFullYear(), month: d.getMonth() })
  }
  const allIncs = bienIds.length > 0
    ? (await supabase.from('incidents').select('created_at').in('bien_id', bienIds).gte('created_at', new Date(now.getFullYear(), now.getMonth()-5, 1).toISOString())).data || []
    : []
  const incidentsByMonth = moisLabels.map(m => ({
    label: m.label,
    value: allIncs.filter(i => { const d = new Date(i.created_at); return d.getMonth()===m.month && d.getFullYear()===m.year }).length,
    color: '#2D5A3D',
  }))

  return {
    role: 'owner',
    biens: biens || [],
    incidents: incs || [],
    messages: msgs || 0,
    totalLoyers,
    incidentsByMonth,
  }
}
