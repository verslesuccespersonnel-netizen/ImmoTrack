import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { useLoad } from '../lib/useLoad'
import Layout from '../components/Layout'

function Donut({ pct, color='#2D5A3D', size=56, label }) {
  const r=20, c=2*Math.PI*r, dash=(pct/100)*c
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
      <svg width={size} height={size} viewBox="0 0 48 48">
        <circle cx="24" cy="24" r={r} fill="none" stroke="#F0EDE6" strokeWidth="5"/>
        <circle cx="24" cy="24" r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={`${dash} ${c}`} strokeLinecap="round" transform="rotate(-90 24 24)"/>
        <text x="24" y="28" textAnchor="middle" fontSize="10" fontWeight="700" fill={color}>{pct}%</text>
      </svg>
      {label && <div style={{fontSize:10,color:'#6B6560'}}>{label}</div>}
    </div>
  )
}

const MGR = ['proprietaire','gestionnaire','agence','admin']

export default function Dashboard() {
  const { profile, session } = useAuth()
  const navigate = useNavigate()

  const { data, loading, error, reload } = useLoad(async () => {
    if (!session?.user || !profile) return null
    if (profile.role === 'locataire') return loadLocataire(session.user.id)
    if (MGR.includes(profile.role)) return loadOwner(session.user.id, profile.role)
    return null
  }, [session?.user?.id, profile?.role])

  if (loading) return <Layout><div className="it-center"><div className="it-spinner"/></div></Layout>
  if (error)   return <Layout><div className="it-center"><div className="alert alert-error">{error}<br/><button className="btn btn-secondary btn-sm" style={{marginTop:8}} onClick={reload}>Reessayer</button></div></div></Layout>

  const biens    = data?.biens || []
  const incidents = data?.incidents || []
  const occupes  = biens.filter(b => b.locations?.some(l => l.statut === 'actif')).length
  const tauxOcc  = biens.length > 0 ? Math.round((occupes / biens.length) * 100) : 0

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {profile?.role === 'locataire' ? `Bonjour, ${profile?.prenom}` : 'Tableau de bord'}
          </h1>
          <p className="page-sub">
            {profile?.role === 'locataire'
              ? (data?.bien ? `${data.bien.adresse}, ${data.bien.ville}` : 'Bienvenue')
              : `${profile?.prenom} ${profile?.nom} — ${biens.length} bien(s)`}
          </p>
        </div>
        {profile?.role !== 'locataire'
          ? <button className="btn btn-primary" onClick={() => navigate('/biens')}>Mes biens</button>
          : (
            <div style={{display:'flex',gap:8}}>
              {data?.bien?.id && (
                <button className="btn btn-secondary" onClick={() => navigate('/biens/'+data.bien.id+'/plan')}>
                  Plan du logement
                </button>
              )}
              <button className="btn btn-primary" onClick={() => navigate('/signaler')}>+ Signaler</button>
            </div>
          )
        }
      </div>

      {profile?.role === 'locataire' ? (
        <div className="grid3" style={{marginBottom:16}}>
          <div className="stat-card"><div className="stat-val" style={{color:incidents.filter(i=>i.gravite==='urgent').length>0?'#B83232':'inherit'}}>{incidents.filter(i=>i.statut!=='resolu').length}</div><div className="stat-label">Incidents ouverts</div></div>
          <div className="stat-card"><div className="stat-val">{data?.messages||0}</div><div className="stat-label">Messages non lus</div></div>
          <div className="stat-card"><div className="stat-val">{data?.docs||0}</div><div className="stat-label">Documents</div></div>
        </div>
      ) : (
        <div className="grid3" style={{marginBottom:16}}>
          <div className="stat-card">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div className="stat-val">{biens.length}</div>
                <div className="stat-label">Biens</div>
                <div className="stat-sub">{occupes} occupe(s)</div>
              </div>
              <Donut pct={tauxOcc} label="Occupation"/>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-val" style={{color:incidents.filter(i=>i.gravite==='urgent').length>0?'#B83232':'inherit'}}>
              {incidents.length}
            </div>
            <div className="stat-label">Incidents ouverts</div>
            <div className="stat-sub">
              {incidents.filter(i=>i.gravite==='urgent').length > 0
                ? `${incidents.filter(i=>i.gravite==='urgent').length} urgent(s)`
                : 'Aucun urgent'}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-val">
              {(data?.totalLoyers||0) > 0 ? `${Number(data.totalLoyers).toLocaleString('fr-FR')} euros` : '--'}
            </div>
            <div className="stat-label">Loyers / mois</div>
          </div>
        </div>
      )}

      {incidents.filter(i=>i.gravite==='urgent').length > 0 && (
        <div className="card" style={{marginBottom:14,borderLeft:'3px solid #B83232'}}>
          <div className="card-header">
            <span className="card-title" style={{color:'#B83232'}}>Incidents urgents</span>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/incidents')}>Voir tout</button>
          </div>
          {incidents.filter(i=>i.gravite==='urgent').slice(0,3).map(inc=>(
            <div key={inc.id} className="row-item" style={{cursor:'pointer'}} onClick={()=>navigate('/incidents')}>
              <span>🔴</span>
              <div style={{flex:1}}><div style={{fontSize:13,fontWeight:500}}>{inc.titre}</div><div style={{fontSize:11,color:'#9E9890'}}>{inc.biens?.adresse}</div></div>
              <span className="status status-yellow">{inc.statut.replace('_',' ')}</span>
            </div>
          ))}
        </div>
      )}

      {incidents.length > 0 && (
        <div className="card" style={{marginBottom:14}}>
          <div className="card-header">
            <span className="card-title">Incidents recents</span>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/incidents')}>Voir tout</button>
          </div>
          {incidents.slice(0,5).map(inc=>(
            <div key={inc.id} className="row-item" style={{cursor:'pointer'}} onClick={()=>navigate('/incidents')}>
              <span>{inc.gravite==='urgent'?'🔴':inc.gravite==='moyen'?'🟡':'🟢'}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{inc.titre}</div>
                <div style={{fontSize:11,color:'#9E9890'}}>{inc.biens?.adresse} — {new Date(inc.created_at).toLocaleDateString('fr-FR')}</div>
              </div>
              <span className={`status ${inc.statut==='resolu'?'status-green':inc.statut==='en_cours'?'status-yellow':'status-blue'}`}>
                {inc.statut.replace('_',' ')}
              </span>
            </div>
          ))}
        </div>
      )}

      {profile?.role !== 'locataire' && biens.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Mes biens</span>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/biens')}>Voir tout</button>
          </div>
          {biens.slice(0,4).map(b => {
            const loc = b.locations?.find(l => l.statut === 'actif')
            return (
              <div key={b.id} className="row-item" style={{cursor:'pointer'}} onClick={() => navigate('/biens')}>
                <span style={{fontSize:18}}>🏠</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:500}}>{b.adresse}</div>
                  <div style={{fontSize:11,color:'#9E9890'}}>{b.ville}{loc?` — ${Number(loc.loyer_mensuel||0).toLocaleString('fr-FR')} euros/mois`:''}</div>
                </div>
                <span className={`status ${loc?'status-green':'status-grey'}`}>{loc?'Occupe':'Vacant'}</span>
              </div>
            )
          })}
        </div>
      )}

      {profile?.role !== 'locataire' && biens.length === 0 && (
        <div className="card">
          <div className="card-body" style={{textAlign:'center',padding:40}}>
            <div style={{fontSize:48}}>🏢</div>
            <h2 style={{fontFamily:'Georgia,serif',fontSize:20,fontWeight:500,margin:'12px 0 8px'}}>Bienvenue !</h2>
            <p style={{color:'#6B6560',fontSize:13,marginBottom:16}}>Commencez par ajouter votre premier bien.</p>
            <button className="btn btn-primary" onClick={() => navigate('/biens')}>+ Ajouter un bien</button>
          </div>
        </div>
      )}
    </Layout>
  )
}

async function loadLocataire(userId) {
  const [locRes, incRes, msgRes, docRes] = await Promise.all([
    supabase.from('locations').select('biens(id,adresse,ville)').eq('locataire_id',userId).eq('statut','actif').limit(1),
    supabase.from('incidents').select('id,titre,statut,gravite,created_at').eq('signale_par',userId).neq('statut','resolu').order('created_at',{ascending:false}).limit(5),
    supabase.from('messages').select('id',{count:'exact',head:true}).eq('destinataire',userId).eq('lu',false),
    supabase.from('documents').select('id',{count:'exact',head:true}),
  ])
  return {
    role: 'locataire',
    bien: locRes.data?.[0]?.biens || null,
    incidents: incRes.data || [],
    messages: msgRes.count || 0,
    docs: docRes.count || 0,
  }
}

async function loadOwner(userId, role) {
  const isAdmin = role === 'admin'
  const biensQuery = isAdmin
    ? supabase.from('biens').select('id,adresse,ville,type_bien,locations(id,statut,loyer_mensuel)')
    : supabase.from('biens').select('id,adresse,ville,type_bien,locations(id,statut,loyer_mensuel)').eq('proprietaire_id', userId)

  const { data: biens } = await biensQuery
  const myBiens = biens || []
  const bienIds = myBiens.map(b => b.id)

  const [incRes] = await Promise.all([
    bienIds.length > 0
      ? supabase.from('incidents').select('id,titre,statut,gravite,created_at,biens(adresse)').in('bien_id',bienIds).neq('statut','resolu').order('created_at',{ascending:false}).limit(10)
      : Promise.resolve({data:[]}),
  ])

  const totalLoyers = myBiens.reduce((sum, b) => {
    const loc = b.locations?.find(l => l.statut === 'actif')
    return sum + Number(loc?.loyer_mensuel || 0)
  }, 0)

  return {
    role: 'owner',
    biens: myBiens,
    incidents: incRes.data || [],
    totalLoyers,
  }
}
