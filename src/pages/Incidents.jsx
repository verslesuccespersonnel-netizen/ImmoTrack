// src/pages/Incidents.jsx
import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase, updateIncident, sendMessage, uploadMedia } from '../lib/supabase'
import Layout from '../components/Layout'
import IncidentRow from '../components/IncidentRow'
import { formatDate, graviteLabel, statutLabel, graviteColor, statutColor } from '../lib/utils'
import { useDropzone } from 'react-dropzone'

// ── LISTE ────────────────────────────────────────────────
export default function Incidents() {
  const { id } = useParams()
  if (id) return <IncidentDetail id={id} />
  return <IncidentsList />
}

function IncidentsList() {
  const { profile, session } = useAuth()
  const navigate = useNavigate()
  const [incidents, setIncidents] = useState([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('all')
  const [search, setSearch]     = useState('')

  useEffect(() => { loadIncidents() }, [session, profile])

  async function loadIncidents() {
    if (!session || !profile) return
    setLoading(true)
    try {
      let query = supabase
        .from('incidents')
        .select(`
          *,
          piece:pieces(nom),
          bien:biens(adresse, ville),
          medias(id),
          assigned:profiles!incidents_assigned_to_fkey(nom, prenom)
        `)
        .order('created_at', { ascending: false })

      if (profile.role === 'locataire') {
        query = query.eq('signale_par', session.user.id)
      } else {
        const { data: biens } = await supabase
          .from('biens').select('id').eq('proprietaire_id', session.user.id)
        const ids = (biens || []).map(b => b.id)
        if (ids.length === 0) { setIncidents([]); return }
        query = query.in('bien_id', ids)
      }

      const { data } = await query
      setIncidents(data || [])
    } finally {
      setLoading(false)
    }
  }

  const filtered = incidents.filter(i => {
    if (filter === 'urgent')    return i.gravite === 'urgent'
    if (filter !== 'all')       return i.statut === filter
    return true
  }).filter(i =>
    !search || i.titre.toLowerCase().includes(search.toLowerCase()) ||
    i.piece?.nom?.toLowerCase().includes(search.toLowerCase())
  )

  const counts = {
    all:       incidents.length,
    nouveau:   incidents.filter(i => i.statut === 'nouveau').length,
    en_cours:  incidents.filter(i => i.statut === 'en_cours').length,
    resolu:    incidents.filter(i => i.statut === 'resolu').length,
    urgent:    incidents.filter(i => i.gravite === 'urgent').length,
  }

  return (
    <Layout>
      <div style={css.header}>
        <div>
          <h1 style={css.h1}>Incidents</h1>
          <p style={css.subtitle}>{incidents.length} incident(s) enregistré(s)</p>
        </div>
        {profile?.role === 'locataire' && (
          <button style={css.btnPrimary} onClick={() => navigate('/signaler')}>
            ➕ Signaler
          </button>
        )}
      </div>

      {/* SEARCH */}
      <div style={css.searchWrap}>
        <span style={css.searchIcon}>🔍</span>
        <input style={css.searchInput} placeholder="Rechercher un incident…"
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* FILTERS */}
      <div style={css.filterRow}>
        {[
          ['all',      `Tous (${counts.all})`],
          ['nouveau',  `Nouveaux (${counts.nouveau})`],
          ['en_cours', `En cours (${counts.en_cours})`],
          ['resolu',   `Résolus (${counts.resolu})`],
          ['urgent',   `🔴 Urgents (${counts.urgent})`],
        ].map(([val, label]) => (
          <button key={val} style={chipStyle(filter === val)} onClick={() => setFilter(val)}>
            {label}
          </button>
        ))}
      </div>

      {loading
        ? <div style={css.loading}>Chargement...</div>
        : <div style={css.card}>
            {filtered.length === 0
              ? <div style={css.empty}>Aucun incident dans cette catégorie.</div>
              : filtered.map(inc => (
                  <IncidentRow key={inc.id} incident={inc}
                    showBien={profile?.role !== 'locataire'}
                    onClick={() => navigate(`/incidents/${inc.id}`)} />
                ))
            }
          </div>
      }
    </Layout>
  )
}

// ── DÉTAIL ───────────────────────────────────────────────
function IncidentDetail({ id }) {
  const { profile, session } = useAuth()
  const navigate = useNavigate()
  const [incident, setIncident] = useState(null)
  const [messages, setMessages] = useState([])
  const [prestataires, setPrestataires] = useState([])
  const [activeTab, setActiveTab] = useState('details')
  const [msgText, setMsgText] = useState('')
  const [saving, setSaving] = useState(false)
  const [newMsg, setNewMsg] = useState('')
  const [uploading, setUploading] = useState(false)

  useEffect(() => { loadAll() }, [id])

  async function loadAll() {
    // Incident complet
    const { data: inc } = await supabase
      .from('incidents')
      .select(`
        *,
        piece:pieces(nom),
        element:elements(nom),
        bien:biens(adresse, ville),
        signale_par_profile:profiles!incidents_signale_par_fkey(nom, prenom),
        assigned:profiles!incidents_assigned_to_fkey(nom, prenom),
        medias(*, uploaded_by:profiles(nom, prenom)),
        audit_log(action, details, created_at, user:profiles(nom, prenom))
      `)
      .eq('id', id)
      .single()
    setIncident(inc)

    // Messages du fil
    const { data: msgs } = await supabase
      .from('messages')
      .select('*, expediteur:profiles!messages_expediteur_fkey(nom, prenom)')
      .eq('incident_id', id)
      .order('created_at', { ascending: true })
    setMessages(msgs || [])

    // Marquer messages lus
    if (session) {
      await supabase.from('messages')
        .update({ lu: true })
        .eq('incident_id', id)
        .eq('destinataire', session.user.id)
    }

    // Prestataires (owner only)
    if (profile?.role !== 'locataire') {
      const { data: presta } = await supabase
        .from('prestataires').select('*').order('note_moyenne', { ascending: false })
      setPrestataires(presta || [])
    }
  }

  async function saveStatus(statut) {
    setSaving(true)
    await updateIncident(id, { statut })
    await supabase.from('audit_log').insert({
      table_name: 'incidents', record_id: id, action: 'update',
      user_id: session.user.id, details: { statut }
    })
    await loadAll()
    setSaving(false)
  }

  async function assignPresta(prestaId) {
    const p = prestataires.find(x => x.id === prestaId)
    setSaving(true)
    await updateIncident(id, { assigned_to: p.profile_id })
    await supabase.from('audit_log').insert({
      table_name: 'incidents', record_id: id, action: 'update',
      user_id: session.user.id, details: { assigned: p.nom_entreprise }
    })
    await loadAll()
    setSaving(false)
  }

  async function handleSendMessage() {
    if (!newMsg.trim() || !incident) return
    const dest = profile?.role === 'locataire'
      ? incident.bien?.proprietaire_id
      : incident.signale_par
    await sendMessage({
      incidentId: id,
      expediteur: session.user.id,
      destinataire: dest,
      contenu: newMsg.trim(),
    })
    setNewMsg('')
    await loadAll()
  }

  // Upload média depuis détail
  const { getRootProps, getInputProps } = useDropzone({
    onDrop: async (files) => {
      setUploading(true)
      for (const file of files) {
        await uploadMedia({
          incidentId: id,
          elementId: incident?.element_id,
          file,
          commentaire: '',
          uploadedBy: session.user.id,
        })
      }
      await loadAll()
      setUploading(false)
    },
    accept: { 'image/*': [], 'video/*': [], 'application/pdf': [] },
    maxSize: 100 * 1024 * 1024,
  })

  if (!incident) return <Layout><div style={css.loading}>Chargement...</div></Layout>

  const isOwner = profile?.role !== 'locataire'
  const gc = graviteColor(incident.gravite)
  const sc = statutColor(incident.statut)

  return (
    <Layout>
      {/* BREADCRUMB */}
      <div style={css.breadcrumb}>
        <span style={css.breadLink} onClick={() => navigate('/incidents')}>← Incidents</span>
        <span style={{ color: '#9E9890' }}> / </span>
        <span style={{ color: '#1A1714' }}>{incident.titre}</span>
      </div>

      {/* HEADER INCIDENT */}
      <div style={css.incHeader}>
        <div style={{ flex: 1 }}>
          <h1 style={{ ...css.h1, marginBottom: 6 }}>{incident.titre}</h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ ...css.badge, background: gc + '22', color: gc }}>
              {graviteLabel(incident.gravite)}
            </span>
            <span style={{ ...css.badge, background: sc + '22', color: sc }}>
              {statutLabel(incident.statut)}
            </span>
            <span style={{ fontSize: 12, color: '#9E9890' }}>
              {incident.piece?.nom} · {formatDate(incident.created_at)}
            </span>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div style={css.tabs}>
        {[
          ['details', 'Détails'],
          ['medias',  `Médias (${incident.medias?.length || 0})`],
          ['messages',`Messages (${messages.length})`],
          ['timeline','Historique'],
          ...(isOwner ? [['actions','Actions']] : []),
        ].map(([val, label]) => (
          <div key={val} style={tabStyle(activeTab === val)} onClick={() => setActiveTab(val)}>
            {label}
          </div>
        ))}
      </div>

      {/* TAB CONTENT */}
      <div style={css.card}>
        <div style={{ padding: '20px' }}>

          {/* DÉTAILS */}
          {activeTab === 'details' && (
            <div>
              <div style={css.grid2}>
                <InfoField label="Bien" value={`${incident.bien?.adresse}, ${incident.bien?.ville}`} />
                <InfoField label="Pièce" value={incident.piece?.nom || '—'} />
                <InfoField label="Élément" value={incident.element?.nom || '—'} />
                <InfoField label="Catégorie" value={incident.categorie} />
                <InfoField label="Signalé par"
                  value={`${incident.signale_par_profile?.prenom} ${incident.signale_par_profile?.nom}`} />
                <InfoField label="Assigné à"
                  value={incident.assigned
                    ? `${incident.assigned.prenom} ${incident.assigned.nom}`
                    : 'Non assigné'} />
              </div>
              {incident.description && (
                <div style={{ marginTop: 16 }}>
                  <div style={css.fieldLabel}>Description</div>
                  <div style={css.fieldValue}>{incident.description}</div>
                </div>
              )}
            </div>
          )}

          {/* MÉDIAS */}
          {activeTab === 'medias' && (
            <div>
              <div style={css.mediaGrid}>
                {(incident.medias || []).map(m => (
                  <div key={m.id} style={css.mediaThumb}>
                    {m.type === 'photo'
                      ? <img src={m.url} alt={m.nom_fichier}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} />
                      : <div style={{ fontSize: 28, textAlign: 'center' }}>
                          {m.type === 'video' ? '🎬' : m.type === 'audio' ? '🎵' : '📄'}
                        </div>
                    }
                    {m.commentaire && (
                      <div style={css.mediaCaption}>{m.commentaire}</div>
                    )}
                    <div style={css.mediaInfo}>
                      {m.uploaded_by?.prenom} · {formatDate(m.created_at, true)}
                    </div>
                  </div>
                ))}
                {/* Upload zone */}
                <div {...getRootProps()} style={css.mediaAdd}>
                  <input {...getInputProps()} />
                  <div style={{ fontSize: 28 }}>{uploading ? '⏳' : '+'}</div>
                  <div style={{ fontSize: 11, color: '#9E9890' }}>
                    {uploading ? 'Upload...' : 'Ajouter'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MESSAGES */}
          {activeTab === 'messages' && (
            <div>
              <div style={css.msgThread}>
                {messages.length === 0 && (
                  <div style={css.empty}>Aucun message pour cet incident.</div>
                )}
                {messages.map(m => {
                  const mine = m.expediteur === session?.user.id
                  return (
                    <div key={m.id} style={{ display: 'flex', flexDirection: mine ? 'row-reverse' : 'row',
                                             gap: 8, alignItems: 'flex-end' }}>
                      <div style={{ ...css.avatar, background: mine ? '#2D5A3D' : '#EBF2FC',
                                    color: mine ? 'white' : '#2B5EA7', fontSize: 11 }}>
                        {m.expediteur_profile?.prenom?.[0] || '?'}
                      </div>
                      <div style={{ ...css.bubble, background: mine ? '#2D5A3D' : '#F7F5F0',
                                    color: mine ? 'white' : '#1A1714',
                                    borderBottomRightRadius: mine ? 4 : 12,
                                    borderBottomLeftRadius: mine ? 12 : 4 }}>
                        <div style={{ fontSize: 13 }}>{m.contenu}</div>
                        <div style={{ fontSize: 10, opacity: 0.6, marginTop: 4, textAlign: 'right' }}>
                          {m.expediteur?.prenom} · {formatDate(m.created_at, true)}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={css.msgInput}>
                <input style={css.input} value={newMsg} placeholder="Votre message…"
                  onChange={e => setNewMsg(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSendMessage() }} />
                <button style={css.btnPrimary} onClick={handleSendMessage}>Envoyer</button>
              </div>
            </div>
          )}

          {/* TIMELINE */}
          {activeTab === 'timeline' && (
            <div style={css.timeline}>
              {(incident.audit_log || []).length === 0 && (
                <div style={css.empty}>Aucune action enregistrée.</div>
              )}
              {[
                { action: 'Incident créé', date: incident.created_at,
                  by: `${incident.signale_par_profile?.prenom} ${incident.signale_par_profile?.nom}`,
                  dot: '#B83232' },
                ...(incident.audit_log || []).map(l => ({
                  action: l.action === 'update' ? `Mis à jour : ${JSON.stringify(l.details)}` : l.action,
                  date: l.created_at,
                  by: `${l.user?.prenom} ${l.user?.nom}`,
                  dot: '#2D5A3D',
                }))
              ].map((item, i) => (
                <div key={i} style={css.timelineItem}>
                  <div style={{ ...css.timelineDot, background: item.dot }} />
                  <div>
                    <div style={{ fontSize: 13 }}>{item.action}</div>
                    <div style={{ fontSize: 11, color: '#9E9890' }}>
                      {item.by} · {formatDate(item.date, true)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ACTIONS (owner) */}
          {activeTab === 'actions' && isOwner && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={css.fieldLabel}>Changer le statut</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  {[['nouveau','Nouveau'],['en_cours','En cours'],['resolu','Résolu'],['annule','Annulé']].map(([val, lbl]) => (
                    <button key={val}
                      style={{
                        padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
                        fontFamily: 'inherit', fontSize: 12, fontWeight: 500,
                        border: `1.5px solid ${incident.statut === val ? statutColor(val) : 'rgba(0,0,0,0.12)'}`,
                        background: incident.statut === val ? statutColor(val) + '18' : '#fff',
                        color: incident.statut === val ? statutColor(val) : '#6B6560',
                        opacity: saving ? 0.6 : 1,
                      }}
                      onClick={() => saveStatus(val)} disabled={saving}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div style={css.fieldLabel}>Assigner un prestataire</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                  {prestataires.map(p => (
                    <div key={p.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 14px', border: '1px solid rgba(0,0,0,0.08)',
                      borderRadius: 8, cursor: 'pointer', background: '#fff',
                    }} onClick={() => assignPresta(p.id)}>
                      <div style={{ fontSize: 20 }}>🔧</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{p.nom_entreprise}</div>
                        <div style={{ fontSize: 12, color: '#6B6560' }}>{p.specialite} · ⭐ {p.note_moyenne}</div>
                      </div>
                      <button style={css.btnPrimary}>Assigner</button>
                    </div>
                  ))}
                  {prestataires.length === 0 && (
                    <div style={css.empty}>Aucun prestataire enregistré.</div>
                  )}
                </div>
              </div>

              <div>
                <div style={css.fieldLabel}>Message au locataire</div>
                <textarea style={{ ...css.input, minHeight: 80, marginTop: 6, resize: 'vertical' }}
                  value={msgText} onChange={e => setMsgText(e.target.value)}
                  placeholder="Rédigez votre message…" />
                <button style={{ ...css.btnPrimary, marginTop: 8 }}
                  onClick={async () => {
                    if (!msgText.trim()) return
                    await sendMessage({
                      incidentId: id, expediteur: session.user.id,
                      destinataire: incident.signale_par, contenu: msgText.trim(),
                    })
                    setMsgText('')
                    setActiveTab('messages')
                    await loadAll()
                  }}>
                  ✉️ Envoyer
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </Layout>
  )
}

// ── HELPERS ─────────────────────────────────────────────
function InfoField({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#9E9890',
                    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 500, color: '#1A1714' }}>{value}</div>
    </div>
  )
}

function chipStyle(active) {
  return {
    padding: '5px 13px', borderRadius: 20, fontSize: 12, fontWeight: 500,
    cursor: 'pointer', border: `1px solid ${active ? '#2D5A3D' : 'rgba(0,0,0,0.12)'}`,
    background: active ? '#2D5A3D' : '#fff', color: active ? '#fff' : '#6B6560',
    fontFamily: 'inherit', transition: '0.15s',
  }
}

function tabStyle(active) {
  return {
    padding: '10px 16px', fontSize: 13.5, fontWeight: 500, cursor: 'pointer',
    borderBottom: `2px solid ${active ? '#2D5A3D' : 'transparent'}`,
    color: active ? '#2D5A3D' : '#6B6560', transition: '0.15s', userSelect: 'none',
  }
}

const css = {
  loading:      { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200, color: '#6B6560' },
  header:       { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 16, flexWrap: 'wrap' },
  h1:           { fontFamily: 'Georgia,serif', fontSize: 24, fontWeight: 500, color: '#1A1714', margin: 0 },
  subtitle:     { fontSize: 13, color: '#6B6560', margin: '4px 0 0' },
  breadcrumb:   { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, fontSize: 13 },
  breadLink:    { color: '#2D5A3D', cursor: 'pointer' },
  incHeader:    { display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 16, flexWrap: 'wrap' },
  badge:        { display: 'inline-flex', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 },
  tabs:         { display: 'flex', borderBottom: '1px solid rgba(0,0,0,0.08)', marginBottom: 0 },
  card:         { background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12, overflow: 'hidden' },
  grid2:        { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  fieldLabel:   { fontSize: 11, fontWeight: 600, color: '#9E9890', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 },
  fieldValue:   { fontSize: 13, color: '#1A1714', lineHeight: 1.6 },
  mediaGrid:    { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 },
  mediaThumb:   { aspectRatio: '1', borderRadius: 8, border: '1px solid rgba(0,0,0,0.08)', background: '#F7F5F0', overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  mediaCaption: { position: 'absolute', bottom: 22, left: 0, right: 0, background: 'rgba(0,0,0,0.55)', color: 'white', fontSize: 10, padding: '3px 6px', textAlign: 'center' },
  mediaInfo:    { position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.45)', color: 'white', fontSize: 9, padding: '2px 5px', textAlign: 'center' },
  mediaAdd:     { aspectRatio: '1', borderRadius: 8, border: '2px dashed rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer', transition: '0.15s' },
  msgThread:    { display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16, minHeight: 80 },
  msgInput:     { display: 'flex', gap: 8, borderTop: '1px solid rgba(0,0,0,0.07)', paddingTop: 12 },
  avatar:       { width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, flexShrink: 0 },
  bubble:       { maxWidth: '72%', padding: '10px 14px', borderRadius: 12, lineHeight: 1.5 },
  timeline:     { display: 'flex', flexDirection: 'column', gap: 16 },
  timelineItem: { display: 'flex', gap: 12, alignItems: 'flex-start' },
  timelineDot:  { width: 10, height: 10, borderRadius: '50%', marginTop: 4, flexShrink: 0 },
  input:        { padding: '9px 12px', border: '1px solid rgba(0,0,0,0.15)', borderRadius: 8, fontFamily: 'inherit', fontSize: 13.5, outline: 'none', width: '100%', boxSizing: 'border-box', flex: 1 },
  btnPrimary:   { padding: '9px 18px', background: '#2D5A3D', color: '#fff', border: 'none', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' },
  searchWrap:   { position: 'relative', marginBottom: 12 },
  searchIcon:   { position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', fontSize: 14 },
  searchInput:  { width: '100%', padding: '9px 12px 9px 34px', border: '1px solid rgba(0,0,0,0.15)', borderRadius: 8, fontFamily: 'inherit', fontSize: 13.5, outline: 'none', boxSizing: 'border-box' },
  filterRow:    { display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  empty:        { padding: '32px', textAlign: 'center', color: '#9E9890', fontSize: 13 },
}
