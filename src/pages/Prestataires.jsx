// src/pages/Prestataires.jsx
import React, { useEffect, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const SPECIALITES = ['plomberie','electricite','chauffage','menuiserie','structure','serrurerie','peinture','autre']
const SPECIALITE_ICONS = { plomberie:'💧', electricite:'⚡', chauffage:'🔥', menuiserie:'🪚', structure:'🧱', serrurerie:'🔑', peinture:'🎨', autre:'🔧' }

export default function Prestataires() {
  const { session } = useAuth()
  const [presta, setPresta]   = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(false)
  const [selected, setSelected] = useState(null)
  const [form, setForm]       = useState({})
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [filter, setFilter]   = useState('all')

  useEffect(() => { load() }, [session])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('prestataires')
      .select('*')
      .order('note_moyenne', { ascending: false })
    setPresta(data || [])
    setLoading(false)
  }

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function openAdd() { setSelected(null); setForm({}); setError(''); setModal(true) }
  function openEdit(p) {
    setSelected(p)
    setForm({ nom_entreprise: p.nom_entreprise, specialite: p.specialite,
              telephone: p.telephone, email: p.email, note_moyenne: p.note_moyenne })
    setError(''); setModal(true)
  }

  async function save() {
    if (!form.nom_entreprise || !form.specialite) {
      setError('Nom et spécialité obligatoires.'); return
    }
    setSaving(true); setError('')
    try {
      if (selected) {
        await supabase.from('prestataires').update({
          nom_entreprise: form.nom_entreprise, specialite: form.specialite,
          telephone: form.telephone || null, email: form.email || null,
          note_moyenne: Number(form.note_moyenne) || 0
        }).eq('id', selected.id)
      } else {
        await supabase.from('prestataires').insert({
          nom_entreprise: form.nom_entreprise, specialite: form.specialite,
          telephone: form.telephone || null, email: form.email || null,
          note_moyenne: Number(form.note_moyenne) || 0, nb_missions: 0
        })
      }
      setModal(false); await load()
    } catch(e) { setError(e.message) }
    finally { setSaving(false) }
  }

  async function del(id) {
    if (!window.confirm('Supprimer ce prestataire ?')) return
    await supabase.from('prestataires').delete().eq('id', id)
    await load()
  }

  const filtered = filter === 'all' ? presta : presta.filter(p => p.specialite === filter)

  if (loading) return <Layout><div style={css.center}><div style={css.spinner}/></div></Layout>

  return (
    <Layout>
      <div style={css.header}>
        <div>
          <h1 style={css.h1}>Prestataires</h1>
          <p style={css.sub}>{presta.length} prestataire(s) enregistré(s)</p>
        </div>
        <button style={css.btnPrimary} onClick={openAdd}>+ Ajouter un prestataire</button>
      </div>

      {/* Filtres */}
      <div style={css.filterRow}>
        <button style={chip(filter==='all')} onClick={()=>setFilter('all')}>Tous ({presta.length})</button>
        {SPECIALITES.filter(s => presta.some(p=>p.specialite===s)).map(s => (
          <button key={s} style={chip(filter===s)} onClick={()=>setFilter(s)}>
            {SPECIALITE_ICONS[s]} {s.charAt(0).toUpperCase()+s.slice(1)} ({presta.filter(p=>p.specialite===s).length})
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={css.emptyCard}>
          <div style={{ fontSize:48 }}>🔧</div>
          <h2 style={css.emptyTitle}>Aucun prestataire</h2>
          <p style={css.emptySub}>Ajoutez vos artisans et entreprises de confiance.</p>
          <button style={css.btnPrimary} onClick={openAdd}>+ Ajouter un prestataire</button>
        </div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {filtered.map(p => (
          <div key={p.id} style={css.card}>
            <div style={{ display:'flex', alignItems:'center', gap:14 }}>
              <div style={css.avatar}>{SPECIALITE_ICONS[p.specialite]||'🔧'}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:600, fontSize:14 }}>{p.nom_entreprise}</div>
                <div style={{ fontSize:12, color:'#6B6560', marginTop:2 }}>
                  {p.specialite.charAt(0).toUpperCase()+p.specialite.slice(1)}
                  {p.telephone && ` · ${p.telephone}`}
                  {p.email && ` · ${p.email}`}
                </div>
                <div style={{ display:'flex', gap:12, marginTop:4 }}>
                  <span style={css.stars}>{'★'.repeat(Math.round(p.note_moyenne))}{'☆'.repeat(5-Math.round(p.note_moyenne))}</span>
                  <span style={{ fontSize:12, color:'#9E9890' }}>{p.note_moyenne}/5 · {p.nb_missions} mission(s)</span>
                </div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button style={css.btnSm} onClick={()=>openEdit(p)}>✏️ Modifier</button>
                <button style={css.btnSmDanger} onClick={()=>del(p.id)}>🗑️</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL */}
      {modal && (
        <div style={css.overlay} onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div style={css.modal}>
            <div style={css.modalHeader}>
              <span style={css.modalTitle}>{selected ? '✏️ Modifier' : '+ Nouveau prestataire'}</span>
              <button style={css.closeBtn} onClick={()=>setModal(false)}>✕</button>
            </div>
            <div style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:14 }}>
              {error && <div style={css.errorBox}>{error}</div>}
              <F label="Nom de l'entreprise" value={form.nom_entreprise||''} onChange={v=>set('nom_entreprise',v)} required placeholder="Plomberie Martin & Fils" />
              <SF label="Spécialité" value={form.specialite||''} onChange={v=>set('specialite',v)} required options={SPECIALITES} />
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <F label="Téléphone" value={form.telephone||''} onChange={v=>set('telephone',v)} placeholder="06 12 34 56 78" />
                <F label="Email" value={form.email||''} onChange={v=>set('email',v)} type="email" placeholder="contact@artisan.fr" />
              </div>
              <F label="Note (0-5)" value={form.note_moyenne||''} onChange={v=>set('note_moyenne',v)} type="number" placeholder="4.5" />
              <button style={css.btnPrimary} onClick={save} disabled={saving}>
                {saving ? 'Enregistrement…' : (selected ? '💾 Mettre à jour' : '+ Ajouter')}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

function F({ label, value, onChange, type='text', placeholder, required }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
      <label style={css.label}>{label}{required&&' *'}</label>
      <input style={css.input} type={type} value={value} placeholder={placeholder} onChange={e=>onChange(e.target.value)} />
    </div>
  )
}
function SF({ label, value, onChange, options, required }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
      <label style={css.label}>{label}{required&&' *'}</label>
      <select style={css.input} value={value} onChange={e=>onChange(e.target.value)}>
        <option value="">— Choisir —</option>
        {options.map(o=><option key={o} value={o}>{o.charAt(0).toUpperCase()+o.slice(1)}</option>)}
      </select>
    </div>
  )
}
function chip(active) {
  return { padding:'5px 13px', borderRadius:20, fontSize:12, fontWeight:500, cursor:'pointer', fontFamily:'inherit',
    border:`1px solid ${active?'#2D5A3D':'rgba(0,0,0,0.12)'}`, background:active?'#2D5A3D':'#fff', color:active?'#fff':'#6B6560' }
}

const css = {
  center:      { display:'flex', alignItems:'center', justifyContent:'center', minHeight:300 },
  spinner:     { width:32, height:32, borderRadius:'50%', border:'3px solid #E8F2EB', borderTopColor:'#2D5A3D', animation:'spin 0.8s linear infinite' },
  header:      { display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20, gap:16, flexWrap:'wrap' },
  h1:          { fontFamily:'Georgia,serif', fontSize:24, fontWeight:500, color:'#1A1714', margin:0 },
  sub:         { fontSize:13, color:'#6B6560', margin:'4px 0 0' },
  filterRow:   { display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 },
  card:        { background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:12, padding:'14px 18px' },
  avatar:      { width:46, height:46, borderRadius:12, background:'#EBF2FC', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 },
  stars:       { color:'#C8813A', fontSize:13 },
  emptyCard:   { background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:'48px 32px', display:'flex', flexDirection:'column', alignItems:'center', gap:14, textAlign:'center' },
  emptyTitle:  { fontFamily:'Georgia,serif', fontSize:18, fontWeight:500, margin:0 },
  emptySub:    { fontSize:13, color:'#6B6560', margin:0 },
  overlay:     { position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 },
  modal:       { background:'#fff', borderRadius:14, width:'100%', maxWidth:480, maxHeight:'88vh', overflowY:'auto', boxShadow:'0 8px 32px rgba(0,0,0,0.15)' },
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
