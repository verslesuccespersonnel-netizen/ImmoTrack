// src/pages/Dashboard.jsx
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import StatCard from '../components/StatCard'
import IncidentRow from '../components/IncidentRow'

export default function Dashboard() {
  const { profile, session } = useAuth()
  const navigate = useNavigate()
  const [data, setData]     = useState(null)   // null = pas encore chargé
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)

  useEffect(() => {
    if (!session?.user || !profile) return
    load()
  }, [session, profile])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      if (profile.role === 'locataire') {
        setData(await loadLocataire())
      } else {
        setData(await loadOwner())
      }
    } catch(e) {
      console.error('Dashboard error:', e)
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadLocataire() {
    const { data: locs } = await supabase
      .from('locations')
      .select('bien_id, bien:biens(id, adresse, ville, type_bien), loyer_mensuel, date_debut, date_fin')
      .eq('locataire_id', session.user.id)
      .eq('statut', 'actif')

    const bienIds = (locs || []).map(l => l.bien_id).filter(Boolean)

    const [incRes, docRes, msgRes] = await Promise.all([
      supabase.from('incidents').select('*, piece:pieces(nom), medias(id)')
        .eq('signale_par', session.user.id)
        .order('created_at', { ascending: false }).limit(5),
      bienIds.length
        ? supabase.from('documents').select('id', { count: 'exact', head: true }).in('bien_id', bienIds)
        : { count: 0 },
      supabase.from('messages').select('id', { count: 'exact', head: true })
        .eq('destinataire', session.user.id).eq('lu', false),
    ])

    return {
      incidents: incRes.data || [],
      documents: docRes.count || 0,
      messages:  msgRes.count || 0,
      biens:     (locs || []).map(l => l.bien).filter(Boolean),
      location:  locs?.[0] || null,
    }
  }

  async function loadOwner() {
    const { data: biens } = await supabase
      .from('biens')
      .select('*, locations(id, locataire_id, locataire:profiles(nom, prenom), loyer_mensuel, statut)')
      .eq('proprietaire_id', session.user.id)

    const bienIds = (biens || []).map(b => b.id)

    const [incRes, msgRes] = await Promise.all([
      bienIds.length
        ? supabase.from('incidents')
            .select('*, piece:pieces(nom), bien:biens(adresse), medias(id)')
            .in('bien_id', bienIds)
            .neq('statut', 'resolu')
            .order('created_at', { ascending: false }).limit(6)
        : { data: [] },
      supabase.from('messages').select('id', { count: 'exact', head: true })
        .eq('destinataire', session.user.id).eq('lu', false),
    ])

    return {
      biens:     biens || [],
      incidents: incRes.data || [],
      messages:  msgRes.count || 0,
    }
  }

  if (loading) return (
    <Layout>
      <div style={css.centerBox}>
        <div style={css.spinner} />
        <div style={{ color: '#6B6560', fontSize: 13, marginTop: 12 }}>Chargement du tableau de bord…</div>
      </div>
    </Layout>
  )

  if (error) return (
    <Layout>
      <div style={{ ...css.centerBox, flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 32 }}>⚠️</div>
        <div style={{ color: '#B83232', fontSize: 13 }}>{error}</div>
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

// ── VUE LOCATAIRE ────────────────────────────────────────
function LocataireDashboard({ data, profile, navigate }) {
  const bien       = data?.biens?.[0]
  const incidents  = data?.incidents || []
  const openCount  = incidents.filter(i => i.statut !== 'resolu').length
  const urgentCount = incidents.filter(i => i.gravite === 'urgent').length

  return (
    <div>
      {/* En-tête */}
      <div style={css.header}>
        <div>
          <h1 style={css.h1}>Bonjour, {profile.prenom} 👋</h1>
          <p style={css.subtitle}>
            {bien ? `${bien.adresse}, ${bien.ville}` : 'Bienvenue sur ImmoTrack'}
          </p>
        </div>
        <button style={css.btnPrimary} onClick={() => navigate('/signaler')}>
          ➕ Signaler un incident
        </button>
      </div>

      {/* Stats */}
      <div style={css.grid3}>
        <StatCard icon="⚠️" label="Incidents ouverts" value={openCount}
          sub={urgentCount > 0 ? `${urgentCount} urgent(s)` : 'Aucun urgent'} danger={urgentCount > 0} />
        <StatCard icon="📄" label="Documents" value={data?.documents || 0} sub="Dans votre espace" />
        <StatCard icon="💬" label="Messages non lus" value={data?.messages || 0}
          sub={data?.messages > 0 ? 'Nouveau(x)' : 'À jour'} />
      </div>

      {/* Incidents récents */}
      {incidents.length > 0 ? (
        <div style={css.card}>
          <div style={css.cardHeader}>
            <span style={css.cardTitle}>Mes incidents récents</span>
            <button style={css.btnLink} onClick={() => navigate('/incidents')}>Voir tout →</button>
          </div>
          {incidents.map(inc => (
            <IncidentRow key={inc.id} incident={inc}
              onClick={() => navigate(`/incidents/${inc.id}`)} />
          ))}
        </div>
      ) : (
        /* État vide guidé */
        <div style={css.emptyCard}>
          <div style={{ fontSize: 48 }}>🏠</div>
          <h2 style={{ fontFamily: 'Georgia,serif', fontSize: 18, fontWeight: 500, margin: 0 }}>
            Tout va bien pour l'instant
          </h2>
          <p style={{ color: '#6B6560', fontSize: 13, maxWidth: 340, textAlign: 'center', margin: 0 }}>
            Aucun incident signalé. Si vous constatez un problème dans votre logement, signalez-le en quelques clics.
          </p>
          <button style={css.btnPrimary} onClick={() => navigate('/signaler')}>
            ➕ Signaler un problème
          </button>

          {/* Guide de démarrage si pas de bien associé */}
          {!bien && (
            <div style={css.infoBox}>
              <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 13 }}>
                📋 En attente d'association à un bien
              </div>
              <div style={{ fontSize: 12, color: '#6B6560', lineHeight: 1.6 }}>
                Votre propriétaire doit vous associer à votre logement dans Supabase
                (table <code style={{ fontFamily: 'monospace', background: '#F0EDE6', padding: '1px 4px', borderRadius: 3 }}>locations</code>).
                Une fois fait, votre adresse apparaîtra ici.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── VUE PROPRIÉTAIRE / GESTIONNAIRE ─────────────────────
function OwnerDashboard({ data, profile, navigate, onRefresh }) {
  const biens     = data?.biens || []
  const incidents = data?.incidents || []
  const urgentCount = incidents.filter(i => i.gravite === 'urgent').length
  const loyers = biens.reduce((sum, b) => {
    const loc = b.locations?.find(l => l.statut === 'actif')
    return sum + (Number(loc?.loyer_mensuel) || 0)
  }, 0)

  const hasData = biens.length > 0

  return (
    <div>
      {/* En-tête */}
      <div style={css.header}>
        <div>
          <h1 style={css.h1}>Tableau de bord</h1>
          <p style={css.subtitle}>
            {profile.prenom} {profile.nom} · {biens.length} bien(s) géré(s)
          </p>
        </div>
        <button style={css.btnPrimary} onClick={() => navigate('/biens')}>
          🏢 Gérer mes biens
        </button>
      </div>

      {/* Stats */}
      <div style={css.grid3}>
        <StatCard icon="🏢" label="Biens gérés" value={biens.length}
          sub={biens.length > 0 ? `${biens.filter(b => b.locations?.some(l=>l.statut==='actif')).length} occupé(s)` : 'Ajoutez votre premier bien'} />
        <StatCard icon="⚠️" label="Incidents ouverts" value={incidents.length}
          sub={urgentCount > 0 ? `🔴 ${urgentCount} urgent(s)` : 'Aucun urgent'} danger={urgentCount > 0} />
        <StatCard icon="💶" label="Loyers / mois"
          value={loyers > 0 ? `${loyers.toLocaleString('fr-FR')} €` : '—'}
          sub={loyers > 0 ? 'Total mensuel' : 'Aucune location active'} />
      </div>

      {/* État vide : guide de démarrage */}
      {!hasData && (
        <div style={css.emptyCard}>
          <div style={{ fontSize: 48 }}>🏢</div>
          <h2 style={{ fontFamily: 'Georgia,serif', fontSize: 20, fontWeight: 500, margin: 0 }}>
            Bienvenue sur ImmoTrack !
          </h2>
          <p style={{ color: '#6B6560', fontSize: 13, maxWidth: 400, textAlign: 'center', margin: 0, lineHeight: 1.6 }}>
            Pour commencer, ajoutez votre premier bien immobilier. Vous pourrez ensuite y associer un locataire et suivre les incidents.
          </p>

          {/* Étapes de démarrage */}
          <div style={{ width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { n: '1', label: 'Ajoutez un bien', desc: 'Menu "Mes biens" → Ajouter', done: false, path: '/biens' },
              { n: '2', label: 'Associez un locataire', desc: 'Via Supabase → Table locations', done: false, path: null },
              { n: '3', label: 'Invitez votre locataire', desc: 'Partagez l\'URL de l\'app', done: false, path: null },
            ].map(step => (
              <div key={step.n} style={css.stepCard}
                onClick={() => step.path && navigate(step.path)}
                role={step.path ? 'button' : undefined}
              >
                <div style={css.stepNum}>{step.n}</div>
                <div>
                  <div style={{ fontWeight: 500, fontSize: 13 }}>{step.label}</div>
                  <div style={{ fontSize: 12, color: '#6B6560' }}>{step.desc}</div>
                </div>
                {step.path && <span style={{ marginLeft: 'auto', color: '#2D5A3D', fontSize: 18 }}>→</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Incidents urgents */}
      {urgentCount > 0 && (
        <div style={{ ...css.card, borderLeft: '3px solid #B83232' }}>
          <div style={css.cardHeader}>
            <span style={{ ...css.cardTitle, color: '#B83232' }}>🔴 Incidents urgents</span>
            <button style={css.btnLink} onClick={() => navigate('/incidents')}>Voir tout →</button>
          </div>
          {incidents.filter(i => i.gravite === 'urgent').map(inc => (
            <IncidentRow key={inc.id} incident={inc} showBien
              onClick={() => navigate(`/incidents/${inc.id}`)} />
          ))}
        </div>
      )}

      {/* Incidents récents */}
      {hasData && (
        <div style={css.card}>
          <div style={css.cardHeader}>
            <span style={css.cardTitle}>Incidents récents</span>
            <button style={css.btnLink} onClick={() => navigate('/incidents')}>Voir tout →</button>
          </div>
          {incidents.length === 0
            ? <div style={{ padding: '28px', textAlign: 'center', color: '#9E9890', fontSize: 13 }}>
                ✅ Aucun incident ouvert.
              </div>
            : incidents.slice(0, 5).map(inc => (
                <IncidentRow key={inc.id} incident={inc} showBien
                  onClick={() => navigate(`/incidents/${inc.id}`)} />
              ))
          }
        </div>
      )}

      {/* Grille biens */}
      {hasData && (
        <>
          <div style={{ ...css.cardTitle, marginBottom: 10 }}>Vos biens</div>
          <div style={css.grid3}>
            {biens.map(b => {
              const loc = b.locations?.find(l => l.statut === 'actif')
              const incCount = incidents.filter(i => i.bien_id === b.id).length
              return (
                <div key={b.id} style={css.bienCard} onClick={() => navigate('/biens')}>
                  <div style={{ fontSize: 22 }}>🏠</div>
                  <div style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.3 }}>{b.adresse}</div>
                  <div style={{ fontSize: 12, color: '#6B6560' }}>{b.type_bien} · {b.ville}</div>
                  {loc
                    ? <div style={{ fontSize: 12, color: '#6B6560' }}>
                        👤 {loc.locataire?.prenom} {loc.locataire?.nom} · {Number(loc.loyer_mensuel).toLocaleString('fr-FR')} €/mois
                      </div>
                    : <div style={{ fontSize: 12, color: '#9E9890' }}>Aucun locataire</div>
                  }
                  {incCount > 0 && (
                    <div style={{ fontSize: 11, color: '#B87E20', fontWeight: 500 }}>
                      ⚠️ {incCount} incident(s) ouvert(s)
                    </div>
                  )}
                </div>
              )
            })}
            {/* Bouton ajout bien */}
            <div style={{ ...css.bienCard, border: '2px dashed rgba(0,0,0,0.12)',
                          alignItems: 'center', justifyContent: 'center',
                          color: '#9E9890', gap: 6 }}
              onClick={() => navigate('/biens')}>
              <div style={{ fontSize: 24 }}>+</div>
              <div style={{ fontSize: 12 }}>Ajouter un bien</div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const css = {
  centerBox:  { display: 'flex', alignItems: 'center', justifyContent: 'center',
                minHeight: 300, flexDirection: 'column' },
  spinner:    { width: 32, height: 32, borderRadius: '50%',
                border: '3px solid #E8F2EB', borderTopColor: '#2D5A3D',
                animation: 'spin 0.8s linear infinite' },
  header:     { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                marginBottom: 24, gap: 16, flexWrap: 'wrap' },
  h1:         { fontFamily: 'Georgia,serif', fontSize: 24, fontWeight: 500,
                color: '#1A1714', margin: 0, lineHeight: 1.2 },
  subtitle:   { fontSize: 13, color: '#6B6560', margin: '4px 0 0' },
  grid3:      { display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))',
                gap: 14, marginBottom: 20 },
  card:       { background: '#fff', border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: 12, overflow: 'hidden', marginBottom: 16 },
  cardHeader: { padding: '14px 18px', borderBottom: '1px solid rgba(0,0,0,0.07)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle:  { fontWeight: 600, fontSize: 13.5 },
  emptyCard:  { background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 14,
                padding: '40px 32px', display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 16, textAlign: 'center', marginBottom: 16 },
  infoBox:    { background: '#E8F2EB', border: '1px solid rgba(45,90,61,0.15)', borderRadius: 10,
                padding: '14px 16px', width: '100%', maxWidth: 480, textAlign: 'left' },
  stepCard:   { background: '#F7F5F0', borderRadius: 10, padding: '12px 14px',
                display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                border: '1px solid rgba(0,0,0,0.07)' },
  stepNum:    { width: 28, height: 28, borderRadius: '50%', background: '#2D5A3D',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, flexShrink: 0 },
  bienCard:   { background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10,
                padding: '14px 16px', cursor: 'pointer', display: 'flex',
                flexDirection: 'column', gap: 5 },
  btnPrimary: { padding: '9px 18px', background: '#2D5A3D', color: '#fff', border: 'none',
                borderRadius: 8, fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
                cursor: 'pointer' },
  btnLink:    { background: 'none', border: 'none', color: '#2D5A3D', fontSize: 13,
                cursor: 'pointer', fontFamily: 'inherit' },
}
