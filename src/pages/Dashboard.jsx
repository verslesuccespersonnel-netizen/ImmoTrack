// src/pages/Dashboard.jsx
import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import StatCard from '../components/StatCard'
import IncidentRow from '../components/IncidentRow'

export default function Dashboard() {
  const { profile, session } = useAuth()
  const navigate = useNavigate()
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const load = useCallback(async () => {
    if (!session?.user || !profile) return
    setLoading(true)
    setError(null)
    try {
      if (profile.role === 'locataire') {
        setData(await loadLocataire(session.user.id))
      } else {
        setData(await loadOwner(session.user.id))
      }
    } catch(e) {
      console.error('Dashboard:', e)
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [session?.user?.id, profile?.role])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <Layout>
      <div style={css.center}>
        <div style={css.spinner} />
        <div style={{ color:'#6B6560', fontSize:13, marginTop:12 }}>Chargement…</div>
      </div>
    </Layout>
  )

  if (error) return (
    <Layout>
      <div style={{ ...css.center, flexDirection:'column', gap:12 }}>
        <div style={{ fontSize:32 }}>⚠️</div>
        <div style={{ color:'#B83232', fontSize:13, maxWidth:320, textAlign:'center' }}>{error}</div>
        <button style={css.btnPrimary} onClick={load}>Réessayer</button>
      </div>
    </Layout>
  )

  return (
    <Layout>
      {profile?.role === 'locataire'
        ? <LocataireDashboard data={data} profile={profile} navigate={navigate} />
        : <OwnerDashboard     data={data} profile={profile} navigate={navigate} onRefresh={load} />
      }
    </Layout>
  )
}

// ── REQUÊTES ─────────────────────────────────────────────
async function loadLocataire(userId) {
  // Locations actives
  const { data: locs } = await supabase
    .from('locations')
    .select('bien_id, loyer_mensuel, date_debut, bien:biens(id, adresse, ville, type_bien)')
    .eq('locataire_id', userId)
    .eq('statut', 'actif')

  const bienIds = (locs || []).map(l => l.bien_id).filter(Boolean)

  // Incidents du locataire
  const { data: incidents } = await supabase
    .from('incidents')
    .select('*, piece:pieces(nom), medias(id)')
    .eq('signale_par', userId)
    .order('created_at', { ascending: false })
    .limit(5)

  // Documents (seulement si biens liés)
  let docCount = 0
  if (bienIds.length > 0) {
    const { count } = await supabase
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .in('bien_id', bienIds)
    docCount = count || 0
  }

  // Messages non lus
  const { count: msgCount } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('destinataire', userId)
    .eq('lu', false)

  return {
    incidents: incidents || [],
    documents: docCount,
    messages:  msgCount || 0,
    biens:     (locs || []).map(l => l.bien).filter(Boolean),
    location:  locs?.[0] || null,
  }
}

async function loadOwner(userId) {
  // Biens du propriétaire
  const { data: biens, error: bErr } = await supabase
    .from('biens')
    .select('*, locations(id, loyer_mensuel, statut, locataire_id, locataire:profiles(nom, prenom))')
    .eq('proprietaire_id', userId)

  if (bErr) throw bErr

  const bienIds = (biens || []).map(b => b.id).filter(Boolean)

  // Incidents ouverts (seulement si biens existent)
  let incidents = []
  if (bienIds.length > 0) {
    const { data } = await supabase
      .from('incidents')
      .select('*, piece:pieces(nom), bien:biens(adresse), medias(id)')
      .in('bien_id', bienIds)
      .neq('statut', 'resolu')
      .order('created_at', { ascending: false })
      .limit(6)
    incidents = data || []
  }

  // Messages non lus
  const { count: msgCount } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('destinataire', userId)
    .eq('lu', false)

  return {
    biens:     biens || [],
    incidents,
    messages:  msgCount || 0,
  }
}

// ── VUE LOCATAIRE ─────────────────────────────────────────
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
          sub={urgentCount > 0 ? `${urgentCount} urgent(s)` : 'Aucun urgent'} danger={urgentCount > 0} />
        <StatCard icon="📄" label="Documents" value={data?.documents || 0} sub="Dans votre espace" />
        <StatCard icon="💬" label="Messages non lus" value={data?.messages || 0}
          sub={data?.messages > 0 ? 'Nouveau(x)' : 'À jour'} />
      </div>

      {incidents.length > 0 ? (
        <div style={css.card}>
          <div style={css.cardHeader}>
            <span style={css.cardTitle}>Mes incidents récents</span>
            <button style={css.btnLink} onClick={() => navigate('/incidents')}>Voir tout →</button>
          </div>
          {incidents.map(inc => (
            <IncidentRow key={inc.id} incident={inc} onClick={() => navigate(`/incidents/${inc.id}`)} />
          ))}
        </div>
      ) : (
        <div style={css.emptyCard}>
          <div style={{ fontSize:48 }}>🏠</div>
          <h2 style={{ fontFamily:'Georgia,serif', fontSize:18, fontWeight:500, margin:0 }}>Tout va bien !</h2>
          <p style={{ color:'#6B6560', fontSize:13, margin:0, textAlign:'center', maxWidth:300 }}>
            Aucun incident signalé. Si vous constatez un problème, signalez-le en quelques clics.
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

// ── VUE PROPRIÉTAIRE / GESTIONNAIRE ──────────────────────
function OwnerDashboard({ data, profile, navigate }) {
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
          <p style={css.sub}>{profile.prenom} {profile.nom} · {biens.length} bien(s) géré(s)</p>
        </div>
        <button style={css.btnPrimary} onClick={() => navigate('/biens')}>🏢 Mes biens</button>
      </div>

      <div style={css.grid3}>
        <StatCard icon="🏢" label="Biens gérés" value={biens.length}
          sub={`${biens.filter(b => b.locations?.some(l => l.statut==='actif')).length} occupé(s)`} />
        <StatCard icon="⚠️" label="Incidents ouverts" value={incidents.length}
          sub={urgentCount > 0 ? `🔴 ${urgentCount} urgent(s)` : 'Aucun urgent'} danger={urgentCount > 0} />
        <StatCard icon="💶" label="Loyers / mois"
          value={loyers > 0 ? `${loyers.toLocaleString('fr-FR')} €` : '—'}
          sub={loyers > 0 ? 'Total mensuel' : 'Aucune location active'} />
      </div>

      {/* Guide si aucun bien */}
      {biens.length === 0 && (
        <div style={css.emptyCard}>
          <div style={{ fontSize:48 }}>🏢</div>
          <h2 style={{ fontFamily:'Georgia,serif', fontSize:20, fontWeight:500, margin:0 }}>Bienvenue !</h2>
          <p style={{ color:'#6B6560', fontSize:13, margin:0, textAlign:'center', maxWidth:380, lineHeight:1.6 }}>
            Commencez par ajouter votre premier bien. Vous pourrez ensuite y créer le plan, ajouter vos pièces et suivre les incidents.
          </p>
          <div style={{ display:'flex', flexDirection:'column', gap:8, width:'100%', maxWidth:400 }}>
            {[
              { n:'1', label:'Ajouter un bien',       desc:'Menu "Mes biens" → + Ajouter', path:'/biens' },
              { n:'2', label:'Dessiner le plan',      desc:'Depuis la fiche du bien → 🗺️ Plan', path:'/biens' },
              { n:'3', label:'Inviter un locataire',  desc:'Partagez l\'URL de l\'app', path:null },
            ].map(s => (
              <div key={s.n} style={css.stepCard} onClick={() => s.path && navigate(s.path)}>
                <div style={css.stepNum}>{s.n}</div>
                <div>
                  <div style={{ fontWeight:500, fontSize:13 }}>{s.label}</div>
                  <div style={{ fontSize:12, color:'#6B6560' }}>{s.desc}</div>
                </div>
                {s.path && <span style={{ marginLeft:'auto', color:'#2D5A3D', fontSize:16 }}>→</span>}
              </div>
            ))}
          </div>
          <button style={css.btnPrimary} onClick={() => navigate('/biens')}>+ Ajouter mon premier bien</button>
        </div>
      )}

      {/* Incidents urgents */}
      {urgentCount > 0 && (
        <div style={{ ...css.card, borderLeft:'3px solid #B83232', marginBottom:16 }}>
          <div style={css.cardHeader}>
            <span style={{ ...css.cardTitle, color:'#B83232' }}>🔴 Incidents urgents</span>
            <button style={css.btnLink} onClick={() => navigate('/incidents')}>Voir tout →</button>
          </div>
          {incidents.filter(i => i.gravite==='urgent').map(inc => (
            <IncidentRow key={inc.id} incident={inc} showBien onClick={() => navigate(`/incidents/${inc.id}`)} />
          ))}
        </div>
      )}

      {/* Incidents récents */}
      {biens.length > 0 && (
        <div style={{ ...css.card, marginBottom:16 }}>
          <div style={css.cardHeader}>
            <span style={css.cardTitle}>Incidents récents</span>
            <button style={css.btnLink} onClick={() => navigate('/incidents')}>Voir tout →</button>
          </div>
          {incidents.length === 0
            ? <div style={{ padding:'28px', textAlign:'center', color:'#9E9890', fontSize:13 }}>✅ Aucun incident ouvert.</div>
            : incidents.slice(0,5).map(inc => (
                <IncidentRow key={inc.id} incident={inc} showBien onClick={() => navigate(`/incidents/${inc.id}`)} />
              ))
          }
        </div>
      )}

      {/* Grille biens */}
      {biens.length > 0 && (
        <>
          <div style={{ fontWeight:600, fontSize:13.5, marginBottom:10 }}>Vos biens</div>
          <div style={css.grid3}>
            {biens.map(b => {
              const loc = b.locations?.find(l => l.statut==='actif')
              return (
                <div key={b.id} style={css.bienCard} onClick={() => navigate('/biens')}>
                  <div style={{ fontSize:22 }}>🏠</div>
                  <div style={{ fontWeight:600, fontSize:13 }}>{b.adresse}</div>
                  <div style={{ fontSize:12, color:'#6B6560' }}>{b.type_bien} · {b.ville}</div>
                  {loc
                    ? <div style={{ fontSize:12, color:'#6B6560' }}>
                        👤 {loc.locataire?.prenom} {loc.locataire?.nom}<br/>
                        {Number(loc.loyer_mensuel).toLocaleString('fr-FR')} €/mois
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
  stepCard:  { background:'#F7F5F0', borderRadius:10, padding:'12px 14px', display:'flex', alignItems:'center', gap:12, cursor:'pointer', border:'1px solid rgba(0,0,0,0.07)' },
  stepNum:   { width:28, height:28, borderRadius:'50%', background:'#2D5A3D', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, flexShrink:0 },
  bienCard:  { background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:10, padding:'14px 16px', cursor:'pointer', display:'flex', flexDirection:'column', gap:5 },
  btnPrimary:{ padding:'9px 18px', background:'#2D5A3D', color:'#fff', border:'none', borderRadius:8, fontFamily:'inherit', fontSize:13, fontWeight:500, cursor:'pointer' },
  btnLink:   { background:'none', border:'none', color:'#2D5A3D', fontSize:13, cursor:'pointer', fontFamily:'inherit' },
}
