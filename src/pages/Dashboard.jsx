// src/pages/Dashboard.jsx — avec timeout sur tous les appels Supabase
import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { usePageData } from '../lib/usePageData'
import Layout from '../components/Layout'
import StatCard from '../components/StatCard'
import IncidentRow from '../components/IncidentRow'

// Reset le timer "stuck" dès que la page se charge correctement
function resetStuck() {
  try { window.__immotrack_reset_stuck && window.__immotrack_reset_stuck() } catch {}
}

async function fetchLocataire(userId) {
  const { data: locs } = await supabase
    .from('locations')
    .select('bien_id, loyer_mensuel, bien:biens(id, adresse, ville, type_bien)')
    .eq('locataire_id', userId).eq('statut', 'actif')

  const bienIds = (locs || []).map(l => l.bien_id).filter(Boolean)

  const [incRes, msgRes] = await Promise.all([
    supabase.from('incidents').select('*, piece:pieces(nom), medias(id)')
      .eq('signale_par', userId)
      .order('created_at', { ascending: false }).limit(5),
    supabase.from('messages').select('id', { count: 'exact', head: true })
      .eq('destinataire', userId).eq('lu', false),
  ])

  let docCount = 0
  if (bienIds.length > 0) {
    const { count } = await supabase.from('documents')
      .select('id', { count: 'exact', head: true }).in('bien_id', bienIds)
    docCount = count || 0
  }

  return {
    incidents: incRes.data || [],
    documents: docCount,
    messages: msgRes.count || 0,
    biens: (locs || []).map(l => l.bien).filter(Boolean),
  }
}

async function fetchOwner(userId) {
  const { data: biens, error } = await supabase
    .from('biens')
    .select('*, locations(id, loyer_mensuel, statut, locataire:profiles(nom, prenom))')
    .eq('proprietaire_id', userId)

  if (error) throw error

  const bienIds = (biens || []).map(b => b.id).filter(Boolean)
  const [incRes, msgRes] = await Promise.all([
    bienIds.length > 0
      ? supabase.from('incidents')
          .select('*, piece:pieces(nom), bien:biens(adresse), medias(id)')
          .in('bien_id', bienIds).neq('statut', 'resolu')
          .order('created_at', { ascending: false }).limit(6)
      : Promise.resolve({ data: [] }),
    supabase.from('messages').select('id', { count: 'exact', head: true })
      .eq('destinataire', userId).eq('lu', false),
  ])

  return {
    biens: biens || [],
    incidents: incRes.data || [],
    messages: msgRes.count || 0,
  }
}

export default function Dashboard() {
  const { profile, session } = useAuth()
  const navigate = useNavigate()

  const { data, loading, error, reload } = usePageData(
    async () => {
      if (!session?.user || !profile) return null
      resetStuck()
      if (profile.role === 'locataire') return fetchLocataire(session.user.id)
      return fetchOwner(session.user.id)
    },
    [session?.user?.id, profile?.role]
  )

  // Reset stuck à chaque rendu réussi
  if (!loading && !error && data) resetStuck()

  if (loading || !data) return (
    <Layout>
      <div style={css.center}>
        <div style={css.spinner}/>
        <div style={{ color:'#9E9890', fontSize:13, marginTop:12 }}>Chargement…</div>
      </div>
    </Layout>
  )

  if (error) return (
    <Layout>
      <div style={{ ...css.center, flexDirection:'column', gap:12 }}>
        <div style={{ fontSize:32 }}>⚠️</div>
        <div style={{ color:'#B83232', fontSize:13, maxWidth:300, textAlign:'center' }}>{error}</div>
        <button style={css.btnPrimary} onClick={reload}>↺ Réessayer</button>
      </div>
    </Layout>
  )

  return (
    <Layout>
      {profile?.role === 'locataire'
        ? <LocataireDashboard data={data} profile={profile} navigate={navigate} />
        : <OwnerDashboard data={data} profile={profile} navigate={navigate} reload={reload} />
      }
    </Layout>
  )
}

function LocataireDashboard({ data, profile, navigate }) {
  const incidents   = data?.incidents || []
  const openCount   = incidents.filter(i => i.statut !== 'resolu').length
  const urgentCount = incidents.filter(i => i.gravite === 'urgent').length
  const bien        = data?.biens?.[0]
  return (
    <div>
      <div style={css.header}>
        <div>
          <h1 style={css.h1}>Bonjour, {profile.prenom} 👋</h1>
          <p style={css.sub}>{bien ? `${bien.adresse}, ${bien.ville}` : 'Bienvenue sur ImmoTrack'}</p>
        </div>
        <button style={css.btnPrimary} onClick={() => navigate('/signaler')}>➕ Signaler un incident</button>
      </div>
      <div style={css.grid3}>
        <StatCard icon="⚠️" label="Incidents ouverts" value={openCount}
          sub={urgentCount > 0 ? `${urgentCount} urgent(s)` : 'Aucun urgent'} danger={urgentCount > 0}/>
        <StatCard icon="📄" label="Documents" value={data?.documents || 0} sub="Dans votre espace"/>
        <StatCard icon="💬" label="Messages non lus" value={data?.messages || 0}
          sub={data?.messages > 0 ? 'Nouveau(x)' : 'À jour'}/>
      </div>
      {incidents.length > 0 ? (
        <div style={css.card}>
          <div style={css.cardHeader}>
            <span style={css.cardTitle}>Mes incidents récents</span>
            <button style={css.btnLink} onClick={() => navigate('/incidents')}>Voir tout →</button>
          </div>
          {incidents.map(inc => (
            <IncidentRow key={inc.id} incident={inc} onClick={() => navigate(`/incidents/${inc.id}`)}/>
          ))}
        </div>
      ) : (
        <div style={css.emptyCard}>
          <div style={{ fontSize:48 }}>🏠</div>
          <h2 style={{ fontFamily:'Georgia,serif', fontSize:18, fontWeight:500, margin:0 }}>Tout va bien !</h2>
          <p style={{ color:'#6B6560', fontSize:13, margin:0, textAlign:'center' }}>
            Aucun incident signalé.
          </p>
          <button style={css.btnPrimary} onClick={() => navigate('/signaler')}>➕ Signaler un problème</button>
          {!bien && (
            <div style={css.infoBox}>
              <strong>En attente d'association</strong><br/>
              <span style={{ fontSize:12 }}>Votre propriétaire doit vous associer à votre logement.</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function OwnerDashboard({ data, profile, navigate, reload }) {
  const biens       = data?.biens || []
  const incidents   = data?.incidents || []
  const urgentCount = incidents.filter(i => i.gravite === 'urgent').length
  const loyers      = biens.reduce((sum, b) => {
    const loc = b.locations?.find(l => l.statut === 'actif')
    return sum + (Number(loc?.loyer_mensuel) || 0)
  }, 0)

  return (
    <div>
      <div style={css.header}>
        <div>
          <h1 style={css.h1}>Tableau de bord</h1>
          <p style={css.sub}>{profile.prenom} {profile.nom} · {biens.length} bien(s)</p>
        </div>
        <button style={css.btnPrimary} onClick={() => navigate('/biens')}>🏢 Mes biens</button>
      </div>
      <div style={css.grid3}>
        <StatCard icon="🏢" label="Biens gérés" value={biens.length}
          sub={`${biens.filter(b=>b.locations?.some(l=>l.statut==='actif')).length} occupé(s)`}/>
        <StatCard icon="⚠️" label="Incidents ouverts" value={incidents.length}
          sub={urgentCount > 0 ? `🔴 ${urgentCount} urgent(s)` : 'Aucun urgent'} danger={urgentCount > 0}/>
        <StatCard icon="💶" label="Loyers / mois"
          value={loyers > 0 ? `${loyers.toLocaleString('fr-FR')} €` : '—'}
          sub={loyers > 0 ? 'Total mensuel' : 'Aucune location active'}/>
      </div>

      {biens.length === 0 && (
        <div style={css.emptyCard}>
          <div style={{ fontSize:48 }}>🏢</div>
          <h2 style={{ fontFamily:'Georgia,serif', fontSize:20, fontWeight:500, margin:0 }}>Bienvenue !</h2>
          <p style={{ color:'#6B6560', fontSize:13, margin:0, textAlign:'center', maxWidth:380, lineHeight:1.6 }}>
            Commencez par ajouter votre premier bien.
          </p>
          <button style={css.btnPrimary} onClick={() => navigate('/biens')}>+ Ajouter mon premier bien</button>
        </div>
      )}

      {urgentCount > 0 && (
        <div style={{ ...css.card, borderLeft:'3px solid #B83232', marginBottom:16 }}>
          <div style={css.cardHeader}>
            <span style={{ ...css.cardTitle, color:'#B83232' }}>🔴 Incidents urgents</span>
            <button style={css.btnLink} onClick={() => navigate('/incidents')}>Voir tout →</button>
          </div>
          {incidents.filter(i=>i.gravite==='urgent').map(inc => (
            <IncidentRow key={inc.id} incident={inc} showBien onClick={() => navigate(`/incidents/${inc.id}`)}/>
          ))}
        </div>
      )}

      {biens.length > 0 && (
        <div style={{ ...css.card, marginBottom:16 }}>
          <div style={css.cardHeader}>
            <span style={css.cardTitle}>Incidents récents</span>
            <button style={css.btnLink} onClick={() => navigate('/incidents')}>Voir tout →</button>
          </div>
          {incidents.length === 0
            ? <div style={{ padding:'24px', textAlign:'center', color:'#9E9890', fontSize:13 }}>✅ Aucun incident ouvert.</div>
            : incidents.slice(0,5).map(inc => (
                <IncidentRow key={inc.id} incident={inc} showBien onClick={() => navigate(`/incidents/${inc.id}`)}/>
              ))
          }
        </div>
      )}

      {biens.length > 0 && (
        <>
          <div style={{ fontWeight:600, fontSize:13.5, marginBottom:10 }}>Vos biens</div>
          <div style={css.grid3}>
            {biens.map(b => {
              const loc = b.locations?.find(l=>l.statut==='actif')
              return (
                <div key={b.id} style={css.bienCard} onClick={() => navigate('/biens')}>
                  <div style={{ fontSize:22 }}>🏠</div>
                  <div style={{ fontWeight:600, fontSize:13 }}>{b.adresse}</div>
                  <div style={{ fontSize:12, color:'#6B6560' }}>{b.type_bien} · {b.ville}</div>
                  {loc
                    ? <div style={{ fontSize:12, color:'#6B6560' }}>
                        👤 {loc.locataire?.prenom} {loc.locataire?.nom} · {Number(loc.loyer_mensuel).toLocaleString('fr-FR')} €/mois
                      </div>
                    : <div style={{ fontSize:12, color:'#9E9890' }}>Aucun locataire</div>
                  }
                </div>
              )
            })}
            <div style={{ ...css.bienCard, border:'2px dashed rgba(0,0,0,0.12)', alignItems:'center', justifyContent:'center', color:'#9E9890', gap:6 }}
              onClick={() => navigate('/biens')}>
              <div style={{ fontSize:24 }}>+</div>
              <div style={{ fontSize:12 }}>Ajouter un bien</div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const css = {
  center:    { display:'flex', alignItems:'center', justifyContent:'center', minHeight:'60vh', flexDirection:'column' },
  spinner:   { width:32, height:32, borderRadius:'50%', border:'3px solid #E8F2EB', borderTopColor:'#2D5A3D', animation:'spin 0.8s linear infinite' },
  header:    { display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24, gap:16, flexWrap:'wrap' },
  h1:        { fontFamily:'Georgia,serif', fontSize:24, fontWeight:500, color:'#1A1714', margin:0 },
  sub:       { fontSize:13, color:'#6B6560', margin:'4px 0 0' },
  grid3:     { display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap:14, marginBottom:20 },
  card:      { background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:12, overflow:'hidden', marginBottom:16 },
  cardHeader:{ padding:'14px 18px', borderBottom:'1px solid rgba(0,0,0,0.07)', display:'flex', alignItems:'center', justifyContent:'space-between' },
  cardTitle: { fontWeight:600, fontSize:13.5 },
  emptyCard: { background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:'40px 24px', display:'flex', flexDirection:'column', alignItems:'center', gap:16, textAlign:'center', marginBottom:16 },
  infoBox:   { background:'#E8F2EB', borderRadius:8, padding:'12px 16px', fontSize:13, color:'#2D5A3D', lineHeight:1.6, width:'100%', maxWidth:380 },
  bienCard:  { background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:10, padding:'14px 16px', cursor:'pointer', display:'flex', flexDirection:'column', gap:5 },
  btnPrimary:{ padding:'9px 18px', background:'#2D5A3D', color:'#fff', border:'none', borderRadius:8, fontFamily:'inherit', fontSize:13, fontWeight:500, cursor:'pointer' },
  btnLink:   { background:'none', border:'none', color:'#2D5A3D', fontSize:13, cursor:'pointer', fontFamily:'inherit' },
}
