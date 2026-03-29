// src/pages/Admin.jsx
import React, { useEffect, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const ROLES = ['locataire','proprietaire','gestionnaire','prestataire']
const ROLE_COLORS = { locataire:'#2B5EA7', proprietaire:'#2D5A3D', gestionnaire:'#C8813A', prestataire:'#6B6560' }
const ROLE_BG = { locataire:'#EBF2FC', proprietaire:'#E8F2EB', gestionnaire:'#FDF3E7', prestataire:'#F7F5F0' }

export default function Admin() {
  const { profile: me } = useAuth()
  const [tab, setTab]         = useState('users')
  const [users, setUsers]     = useState([])
  const [biens, setBiens]     = useState([])
  const [incidents, setInc]   = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(null)
  const [form, setForm]       = useState({})
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [search, setSearch]   = useState('')

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [u, b, i] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('biens').select('*, proprietaire:profiles(nom,prenom), locations(id,statut,locataire:profiles(nom,prenom))').order('created_at', { ascending: false }),
      supabase.from('incidents').select('*, bien:biens(adresse,ville), signale_par_profile:profiles!incidents_signale_par_fkey(nom,prenom)').order('created_at', { ascending: false }).limit(50),
    ])
    setUsers(u.data || [])
    setBiens(b.data || [])
    setInc(i.data || [])
    setLoading(false)
  }

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function saveUser() {
    if (!form.nom || !form.prenom || !form.role) { setError('Tous les champs obligatoires.'); return }
    setSaving(true); setError('')
    try {
      await supabase.from('profiles').update({ nom: form.nom, prenom: form.prenom, role: form.role, telephone: form.telephone || null }).eq('id', modal.id)
      setModal(null); await loadAll()
    } catch(e) { setError(e.message) }
    finally { setSaving(false) }
  }

  async function deleteUser(id) {
    if (!window.confirm('Supprimer ce profil ? Le compte Auth Supabase reste actif.')) return
    await supabase.from('profiles').delete().eq('id', id)
    await loadAll()
  }

  async function changeRole(id, role) {
    await supabase.from('profiles').update({ role }).eq('id', id)
    setUsers(u => u.map(x => x.id === id ? { ...x, role } : x))
  }

  const filteredUsers = users.filter(u =>
    !search ||
    `${u.prenom} ${u.nom}`.toLowerCase().includes(search.toLowerCase()) ||
    u.role.includes(search.toLowerCase())
  )

  const stats = {
    total:        users.length,
    locataires:   users.filter(u=>u.role==='locataire').length,
    proprietaires:users.filter(u=>u.role==='proprietaire').length,
    gestionnaires:users.filter(u=>u.role==='gestionnaire').length,
    biens:        biens.length,
    incidents_ouverts: incidents.filter(i=>i.statut!=='resolu').length,
  }

  if (me?.role !== 'gestionnaire' && me?.role !== 'proprietaire') {
    return <Layout><div style={{ padding:40, textAlign:'center', color:'#B83232' }}>⛔ Accès réservé aux administrateurs.</div></Layout>
  }

  if (loading) return <Layout><div style={css.center}><div style={css.spinner}/></div></Layout>

  return (
    <Layout>
      <div style={css.header}>
        <div>
          <h1 style={css.h1}>Administration</h1>
          <p style={css.sub}>Gestion complète des comptes et données</p>
        </div>
      </div>

      {/* STATS */}
      <div style={css.statsGrid}>
        {[
          { icon:'👥', label:'Comptes total',    value: stats.total },
          { icon:'🏠', label:'Locataires',        value: stats.locataires },
          { icon:'🏢', label:'Propriétaires',     value: stats.proprietaires },
          { icon:'🏗️', label:'Biens',             value: stats.biens },
          { icon:'⚠️', label:'Incidents ouverts', value: stats.incidents_ouverts },
        ].map(s => (
          <div key={s.label} style={css.statCard}>
            <div style={{ fontSize:22 }}>{s.icon}</div>
            <div style={{ fontSize:22, fontWeight:700, color:'#1A1714', lineHeight:1.1 }}>{s.value}</div>
            <div style={{ fontSize:11, color:'#6B6560' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* TABS */}
      <div style={css.tabs}>
        {[['users','👥 Comptes'],['biens','🏢 Biens'],['incidents','⚠️ Incidents']].map(([val,lbl]) => (
          <div key={val} style={{ ...css.tab, ...(tab===val ? css.tabActive : {}) }} onClick={()=>setTab(val)}>
            {lbl}
          </div>
        ))}
      </div>

      {/* ── COMPTES ── */}
      {tab === 'users' && (
        <div style={css.card}>
          <div style={css.cardHeader}>
            <span style={css.cardTitle}>Tous les comptes ({filteredUsers.length})</span>
            <div style={{ position:'relative' }}>
              <input style={{ ...css.searchInput }} placeholder="Rechercher…" value={search} onChange={e=>setSearch(e.target.value)} />
            </div>
          </div>
          {filteredUsers.map(u => (
            <div key={u.id} style={css.userRow}>
              <div style={{ ...css.avatar, background: ROLE_BG[u.role]||'#F7F5F0' }}>
                {u.prenom?.[0]||'?'}{u.nom?.[0]||''}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:600, fontSize:13.5 }}>{u.prenom} {u.nom}</div>
                <div style={{ fontSize:12, color:'#6B6560', marginTop:1 }}>
                  {u.telephone || 'Pas de téléphone'}
                  <span style={{ marginLeft:6, fontSize:10, color:'#9E9890' }}>
                    ID: {u.id.slice(0,8)}…
                  </span>
                </div>
              </div>
              {/* Sélecteur de rôle inline */}
              <select
                style={{ ...css.roleSelect, background: ROLE_BG[u.role], color: ROLE_COLORS[u.role] }}
                value={u.role}
                onChange={e => changeRole(u.id, e.target.value)}
              >
                {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase()+r.slice(1)}</option>)}
              </select>
              <div style={{ display:'flex', gap:6 }}>
                <button style={css.btnSm} onClick={() => {
                  setModal(u)
                  setForm({ nom: u.nom, prenom: u.prenom, role: u.role, telephone: u.telephone||'' })
                  setError('')
                }}>✏️</button>
                {u.id !== me?.id && (
                  <button style={css.btnSmDanger} onClick={() => deleteUser(u.id)}>🗑️</button>
                )}
              </div>
            </div>
          ))}
          {filteredUsers.length === 0 && (
            <div style={{ padding:24, textAlign:'center', color:'#9E9890', fontSize:13 }}>Aucun compte trouvé.</div>
          )}
        </div>
      )}

      {/* ── BIENS ── */}
      {tab === 'biens' && (
        <div style={css.card}>
          <div style={css.cardHeader}><span style={css.cardTitle}>Tous les biens ({biens.length})</span></div>
          {biens.map(b => {
            const locActive = b.locations?.find(l=>l.statut==='actif')
            return (
              <div key={b.id} style={css.userRow}>
                <div style={{ fontSize:22 }}>🏠</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:600, fontSize:13.5 }}>{b.adresse}, {b.ville}</div>
                  <div style={{ fontSize:12, color:'#6B6560' }}>
                    Propriétaire : {b.proprietaire?.prenom} {b.proprietaire?.nom}
                    {locActive && ` · Locataire : ${locActive.locataire?.prenom||'—'} ${locActive.locataire?.nom||''}`}
                  </div>
                </div>
                <span style={{ fontSize:11, color: locActive ? '#2D5A3D' : '#9E9890',
                               background: locActive ? '#E8F2EB' : '#F7F5F0',
                               padding:'3px 9px', borderRadius:20, fontWeight:600 }}>
                  {locActive ? 'Occupé' : 'Vacant'}
                </span>
              </div>
            )
          })}
          {biens.length === 0 && <div style={{ padding:24, textAlign:'center', color:'#9E9890', fontSize:13 }}>Aucun bien.</div>}
        </div>
      )}

      {/* ── INCIDENTS ── */}
      {tab === 'incidents' && (
        <div style={css.card}>
          <div style={css.cardHeader}><span style={css.cardTitle}>Incidents récents ({incidents.length})</span></div>
          {incidents.map(i => (
            <div key={i.id} style={css.userRow}>
              <div style={{ fontSize:20 }}>
                {i.gravite==='urgent' ? '🔴' : i.gravite==='moyen' ? '🟡' : '🟢'}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:600, fontSize:13.5 }}>{i.titre}</div>
                <div style={{ fontSize:12, color:'#6B6560' }}>
                  {i.bien?.adresse} · Signalé par {i.signale_par_profile?.prenom} {i.signale_par_profile?.nom}
                </div>
              </div>
              <span style={{
                fontSize:11, fontWeight:600, padding:'3px 9px', borderRadius:20,
                background: i.statut==='resolu' ? '#E8F2EB' : i.statut==='en_cours' ? '#FDF6E3' : '#EBF2FC',
                color: i.statut==='resolu' ? '#2D5A3D' : i.statut==='en_cours' ? '#B87E20' : '#2B5EA7',
              }}>
                {i.statut.replace('_',' ')}
              </span>
            </div>
          ))}
          {incidents.length === 0 && <div style={{ padding:24, textAlign:'center', color:'#9E9890', fontSize:13 }}>Aucun incident.</div>}
        </div>
      )}

      {/* MODAL ÉDITION UTILISATEUR */}
      {modal && (
        <div style={css.overlay} onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div style={css.modal}>
            <div style={css.modalHeader}>
              <span style={css.modalTitle}>✏️ Modifier le compte</span>
              <button style={css.closeBtn} onClick={()=>setModal(null)}>✕</button>
            </div>
            <div style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:14 }}>
              {error && <div style={css.errorBox}>{error}</div>}
              <div style={{ background:'#F7F5F0', borderRadius:8, padding:'10px 14px', fontSize:12, color:'#6B6560' }}>
                UUID : <code style={{ fontFamily:'monospace' }}>{modal.id}</code>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <Fld label="Prénom" value={form.prenom||''} onChange={v=>set('prenom',v)} required />
                <Fld label="Nom" value={form.nom||''} onChange={v=>set('nom',v)} required />
              </div>
              <Fld label="Téléphone" value={form.telephone||''} onChange={v=>set('telephone',v)} placeholder="06 12 34 56 78" />
              <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                <label style={css.label}>Rôle *</label>
                <select style={css.input} value={form.role||''} onChange={e=>set('role',e.target.value)}>
                  {ROLES.map(r=><option key={r} value={r}>{r.charAt(0).toUpperCase()+r.slice(1)}</option>)}
                </select>
              </div>
              <button style={css.btnPrimary} onClick={saveUser} disabled={saving}>
                {saving ? 'Enregistrement…' : '💾 Mettre à jour'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

function Fld({ label, value, onChange, type='text', placeholder, required }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
      <label style={css.label}>{label}{required&&' *'}</label>
      <input style={css.input} type={type} value={value} placeholder={placeholder} onChange={e=>onChange(e.target.value)} />
    </div>
  )
}

const css = {
  center:      { display:'flex', alignItems:'center', justifyContent:'center', minHeight:300 },
  spinner:     { width:32, height:32, borderRadius:'50%', border:'3px solid #E8F2EB', borderTopColor:'#2D5A3D', animation:'spin 0.8s linear infinite' },
  header:      { display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20, gap:16 },
  h1:          { fontFamily:'Georgia,serif', fontSize:24, fontWeight:500, color:'#1A1714', margin:0 },
  sub:         { fontSize:13, color:'#6B6560', margin:'4px 0 0' },
  statsGrid:   { display:'grid', gridTemplateColumns:'repeat(5,minmax(0,1fr))', gap:12, marginBottom:20 },
  statCard:    { background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:12, padding:'14px 16px', display:'flex', flexDirection:'column', gap:4 },
  tabs:        { display:'flex', borderBottom:'1px solid rgba(0,0,0,0.08)', marginBottom:0 },
  tab:         { padding:'10px 18px', fontSize:13.5, fontWeight:500, color:'#6B6560', cursor:'pointer', borderBottom:'2px solid transparent', transition:'.15s' },
  tabActive:   { color:'#2D5A3D', borderBottomColor:'#2D5A3D' },
  card:        { background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:12, overflow:'hidden', marginTop:0 },
  cardHeader:  { padding:'14px 18px', borderBottom:'1px solid rgba(0,0,0,0.07)', display:'flex', alignItems:'center', justifyContent:'space-between' },
  cardTitle:   { fontWeight:600, fontSize:13.5 },
  userRow:     { display:'flex', alignItems:'center', gap:12, padding:'12px 18px', borderBottom:'1px solid rgba(0,0,0,0.05)' },
  avatar:      { width:36, height:36, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, flexShrink:0 },
  roleSelect:  { padding:'4px 10px', borderRadius:20, border:'none', fontFamily:'inherit', fontSize:12, fontWeight:600, cursor:'pointer', outline:'none' },
  searchInput: { padding:'7px 12px', border:'1px solid rgba(0,0,0,0.15)', borderRadius:8, fontFamily:'inherit', fontSize:13, outline:'none', width:200 },
  overlay:     { position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 },
  modal:       { background:'#fff', borderRadius:14, width:'100%', maxWidth:460, maxHeight:'88vh', overflowY:'auto', boxShadow:'0 8px 32px rgba(0,0,0,0.15)' },
  modalHeader: { padding:'18px 24px 14px', borderBottom:'1px solid rgba(0,0,0,0.08)', display:'flex', alignItems:'center', justifyContent:'space-between' },
  modalTitle:  { fontFamily:'Georgia,serif', fontSize:17, fontWeight:500 },
  closeBtn:    { width:28, height:28, border:'1px solid rgba(0,0,0,0.12)', borderRadius:6, background:'none', cursor:'pointer', fontSize:14 },
  label:       { fontSize:11, fontWeight:600, color:'#6B6560', textTransform:'uppercase', letterSpacing:'.05em' },
  input:       { padding:'9px 12px', border:'1px solid rgba(0,0,0,0.15)', borderRadius:8, fontFamily:'inherit', fontSize:13.5, outline:'none', width:'100%', boxSizing:'border-box' },
  errorBox:    { background:'#FDEAEA', color:'#B83232', border:'1px solid #F7C1C1', borderRadius:8, padding:'10px 14px', fontSize:13 },
  btnPrimary:  { padding:'9px 18px', background:'#2D5A3D', color:'#fff', border:'none', borderRadius:8, fontFamily:'inherit', fontSize:13, fontWeight:500, cursor:'pointer' },
  btnSm:       { padding:'6px 12px', background:'#fff', color:'#1A1714', border:'1px solid rgba(0,0,0,0.15)', borderRadius:7, fontFamily:'inherit', fontSize:12, cursor:'pointer' },
  btnSmDanger: { padding:'6px 12px', background:'#FDEAEA', color:'#B83232', border:'1px solid rgba(184,50,50,0.2)', borderRadius:7, fontFamily:'inherit', fontSize:12, cursor:'pointer' },
}
