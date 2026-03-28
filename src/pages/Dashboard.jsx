// src/pages/Dashboard.jsx
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase, subscribeToIncidents, subscribeToMessages } from '../lib/supabase'
import Layout from '../components/Layout'
import StatCard from '../components/StatCard'
import IncidentRow from '../components/IncidentRow'
import { formatDate } from '../lib/utils'

export default function Dashboard() {
  const { profile, session } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState({ incidents: [], documents: [], messages: 0, biens: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session || !profile) return
    loadData()

    // Notifications temps réel
    let sub
    if (profile.role !== 'locataire') {
      sub = subscribeToIncidents(null, () => loadData())
    }
    const msgSub = subscribeToMessages(session.user.id, () => loadData())

    return () => {
      sub?.unsubscribe()
      msgSub?.unsubscribe()
    }
  }, [session, profile])

  async function loadData() {
    setLoading(true)
    try {
      if (profile.role === 'locataire') await loadLocataireData()
      else await loadOwnerData()
    } finally {
      setLoading(false)
    }
  }

  async function loadLocataireData() {
    // Bien loué
    const { data: locs } = await supabase
      .from('locations')
      .select('*, bien:biens(id, adresse, ville, type_bien)')
      .eq('locataire_id', session.user.id)
      .eq('statut', 'actif')

    const bienIds = (locs || []).map(l => l.bien_id)

    // Incidents
    const { data: incidents } = await supabase
      .from('incidents')
      .select('*, piece:pieces(nom), medias(id)')
      .eq('signale_par', session.user.id)
      .order('created_at', { ascending: false })
      .limit(5)

    // Documents
    const { count: docCount } = await supabase
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .in('bien_id', bienIds)

    // Messages non lus
    const { count: msgCount } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('destinataire', session.user.id)
      .eq('lu', false)

    setData({
      incidents: incidents || [],
      documents: docCount || 0,
      messages: msgCount || 0,
      biens: (locs || []).map(l => l.bien),
      location: locs?.[0] || null,
    })
  }

  async function loadOwnerData() {
    // Biens
    const { data: biens } = await supabase
      .from('biens')
      .select('*, locations(id, locataire:profiles(nom, prenom), loyer_mensuel, statut)')
      .eq('proprietaire_id', session.user.id)

    const bienIds = (biens || []).map(b => b.id)

    // Incidents ouverts
    const { data: incidents } = await supabase
      .from('incidents')
      .select('*, piece:pieces(nom), bien:biens(adresse), medias(id)')
      .in('bien_id', bienIds)
      .neq('statut', 'resolu')
      .order('created_at', { ascending: false })
      .limit(6)

    // Messages non lus
    const { count: msgCount } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('destinataire', session.user.id)
      .eq('lu', false)

    setData({ incidents: incidents || [], messages: msgCount || 0, biens: biens || [] })
  }

  if (loading) return <Layout><div style={css.loading}>Chargement...</div></Layout>

  return (
    <Layout>
      {profile?.role === 'locataire'
        ? <LocataireDashboard data={data} profile={profile} navigate={navigate} />
        : <OwnerDashboard data={data} profile={profile} navigate={navigate} />
      }
    </Layout>
  )
}

// ── LOCATAIRE ────────────────────────────────────────────
function LocataireDashboard({ data, profile, navigate }) {
  const bien = data.biens?.[0]
  const openCount = data.incidents.filter(i => i.statut !== 'resolu').length

  return (
    <div>
      <div style={css.header}>
        <div>
          <h1 style={css.h1}>Bonjour, {profile.prenom} 👋</h1>
          <p style={css.subtitle}>
            {bien ? `${bien.adresse}, ${bien.ville}` : 'Aucun bien associé'}
          </p>
        </div>
        <button style={css.btnPrimary} onClick={() => navigate('/signaler')}>
          ➕ Signaler un incident
        </button>
      </div>

      <div style={css.grid3}>
        <StatCard icon="⚠️" label="Incidents ouverts" value={openCount}
          sub={`${data.incidents.filter(i=>i.gravite==='urgent').length} urgent(s)`} />
        <StatCard icon="📄" label="Documents" value={data.documents}
          sub="Dans votre espace" />
        <StatCard icon="💬" label="Messages non lus" value={data.messages}
          sub={data.messages > 0 ? 'Nouveau(x) message(s)' : 'À jour'} />
      </div>

      {data.incidents.length > 0 && (
        <div style={css.card}>
          <div style={css.cardHeader}>
            <span style={css.cardTitle}>Mes incidents récents</span>
            <button style={css.btnLink} onClick={() => navigate('/incidents')}>Voir tout →</button>
          </div>
          {data.incidents.map(inc => (
            <IncidentRow key={inc.id} incident={inc} onClick={() => navigate(`/incidents/${inc.id}`)} />
          ))}
        </div>
      )}

      {data.incidents.length === 0 && (
        <div style={css.emptyState}>
          <div style={{ fontSize: 42 }}>🏠</div>
          <p style={{ color: '#6B6560' }}>Aucun incident signalé pour le moment.</p>
          <button style={css.btnPrimary} onClick={() => navigate('/signaler')}>
            Signaler un problème
          </button>
        </div>
      )}
    </div>
  )
}

// ── PROPRIÉTAIRE / GESTIONNAIRE ──────────────────────────
function OwnerDashboard({ data, profile, navigate }) {
  const urgentCount = data.incidents.filter(i => i.gravite === 'urgent').length
  const loyers = data.biens.reduce((sum, b) => {
    const loc = b.locations?.find(l => l.statut === 'actif')
    return sum + (loc?.loyer_mensuel || 0)
  }, 0)

  return (
    <div>
      <div style={css.header}>
        <div>
          <h1 style={css.h1}>Tableau de bord</h1>
          <p style={css.subtitle}>{profile.prenom} {profile.nom} · {data.biens.length} bien(s)</p>
        </div>
        <button style={css.btnPrimary} onClick={() => navigate('/biens')}>🏢 Mes biens</button>
      </div>

      <div style={css.grid3}>
        <StatCard icon="🏢" label="Biens gérés" value={data.biens.length} sub="Tous occupés" />
        <StatCard icon="⚠️" label="Incidents ouverts" value={data.incidents.length}
          sub={`${urgentCount} urgent(s)`} danger={urgentCount > 0} />
        <StatCard icon="💶" label="Loyers / mois"
          value={`${loyers.toLocaleString('fr-FR')} €`} sub="Encaissés" />
      </div>

      {urgentCount > 0 && (
        <div style={{ ...css.card, borderLeft: '3px solid #B83232' }}>
          <div style={css.cardHeader}>
            <span style={{ ...css.cardTitle, color: '#B83232' }}>🔴 Incidents urgents</span>
            <button style={css.btnLink} onClick={() => navigate('/incidents')}>Voir tout →</button>
          </div>
          {data.incidents.filter(i => i.gravite === 'urgent').map(inc => (
            <IncidentRow key={inc.id} incident={inc} onClick={() => navigate(`/incidents/${inc.id}`)} />
          ))}
        </div>
      )}

      <div style={css.card}>
        <div style={css.cardHeader}>
          <span style={css.cardTitle}>Incidents récents</span>
          <button style={css.btnLink} onClick={() => navigate('/incidents')}>Voir tout →</button>
        </div>
        {data.incidents.length === 0
          ? <div style={{ padding: '24px', textAlign: 'center', color: '#9E9890' }}>
              Aucun incident en cours. ✅
            </div>
          : data.incidents.slice(0, 5).map(inc => (
              <IncidentRow key={inc.id} incident={inc} showBien
                onClick={() => navigate(`/incidents/${inc.id}`)} />
            ))
        }
      </div>

      <div style={{ marginTop: 4 }}>
        <div style={css.cardTitle}>Vos biens</div>
        <div style={{ ...css.grid3, marginTop: 10 }}>
          {data.biens.map(b => {
            const loc = b.locations?.find(l => l.statut === 'actif')
            return (
              <div key={b.id} style={css.bienCard} onClick={() => navigate('/biens')}>
                <div style={{ fontSize: 22 }}>🏠</div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{b.adresse}</div>
                <div style={{ fontSize: 12, color: '#6B6560' }}>{b.type_bien}</div>
                {loc && (
                  <div style={{ fontSize: 12, color: '#6B6560' }}>
                    {loc.locataire?.prenom} {loc.locataire?.nom} · {loc.loyer_mensuel} €/mois
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const css = {
  loading: { display: 'flex', alignItems: 'center', justifyContent: 'center',
             minHeight: 200, color: '#6B6560' },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            marginBottom: 24, gap: 16, flexWrap: 'wrap' },
  h1: { fontFamily: 'Georgia,serif', fontSize: 24, fontWeight: 500,
        color: '#1A1714', margin: 0, lineHeight: 1.2 },
  subtitle: { fontSize: 13, color: '#6B6560', margin: '4px 0 0' },
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 },
  card: { background: '#fff', border: '1px solid rgba(0,0,0,0.08)',
          borderRadius: 12, overflow: 'hidden', marginBottom: 16 },
  cardHeader: { padding: '14px 18px', borderBottom: '1px solid rgba(0,0,0,0.07)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontWeight: 600, fontSize: 13.5 },
  btnPrimary: { padding: '9px 18px', background: '#2D5A3D', color: '#fff',
                border: 'none', borderRadius: 8, fontFamily: 'inherit',
                fontSize: 13, fontWeight: 500, cursor: 'pointer' },
  btnLink: { background: 'none', border: 'none', color: '#2D5A3D',
             fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  emptyState: { textAlign: 'center', padding: '48px 20px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 },
  bienCard: { background: '#fff', border: '1px solid rgba(0,0,0,0.08)',
              borderRadius: 10, padding: '14px 16px', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', gap: 6,
              transition: '0.15s' },
}
