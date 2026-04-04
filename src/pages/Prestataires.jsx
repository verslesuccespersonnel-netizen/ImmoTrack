import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const SPECIALITES_DEFAULT = [
  'Plomberie','Électricité','Chauffage / Climatisation','Serrurerie',
  'Menuiserie / Vitrage','Peinture / Revêtements','Maçonnerie / Carrelage',
  'Couverture / Toiture','Jardinage / Espaces verts','Nettoyage / Entretien',
  'Ascenseur','Automatisme / Portail','Téléphonie / Réseau','Multi-services',
]

export default function Prestataires() {
  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(null)
  const [form, setForm]       = useState({})
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [search, setSearch]   = useState('')
  const [filterSpe, setFilterSpe] = useState('')
  // Liste des spécialités (extensible)
  const [specialites, setSpecialites] = useState(SPECIALITES_DEFAULT)
  const [newSpe, setNewSpe]   = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('prestataires').select('*').order('nom')
    setItems(data || [])
    // Récupérer les spécialités custom déjà utilisées
    const usedSpe = (data||[]).map(p => p.specialite).filter(Boolean)
    const all = [...new Set([...SPECIALITES_DEFAULT, ...usedSpe])].sort()
    setSpecialites(all)
    setLoading(false)
  }

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function addSpecialite() {
    const s = newSpe.trim()
    if (!s || specialites.includes(s)) return
    setSpecialites(prev => [...prev, s].sort())
    setForm(f => ({ ...f, specialite: s }))
    setNewSpe('')
  }

  async function save() {
    if (!form.nom) { setError('Nom obligatoire'); return }
    setSaving(true); setError('')
    try {
      const payload = {
        nom: form.nom, prenom: form.prenom || null,
        societe: form.societe || null, telephone: form.telephone || null,
        email: form.email || null, specialite: form.specialite || null,
        adresse: form.adresse || null, notes: form.notes || null,
      }
      if (modal.id) {
        await supabase.from('prestataires').update(payload).eq('id', modal.id)
      } else {
        await supabase.from('prestataires').insert(payload)
      }
      setModal(null)
      await load()
    } catch(e) { setError(e.message) }
    finally { setSaving(false) }
  }

  async function del(id) {
    if (!window.confirm('Supprimer ce prestataire ?')) return
    await supabase.from('prestataires').delete().eq('id', id)
    await load()
  }

  const filtered = items.filter(p => {
    const matchSearch = !search || `${p.nom} ${p.prenom||''} ${p.societe||''}`.toLowerCase().includes(search.toLowerCase())
    const matchSpe    = !filterSpe || p.specialite === filterSpe
    return matchSearch && matchSpe
  })

  // Spécialités présentes dans les prestataires
  const usedSpes = [...new Set(items.map(p => p.specialite).filter(Boolean))]

  const SPE_ICONS = {
    'Plomberie':'🚰','Électricité':'⚡','Chauffage / Climatisation':'🌡️',
    'Serrurerie':'🔐','Menuiserie / Vitrage':'🪟','Peinture / Revêtements':'🎨',
    'Maçonnerie / Carrelage':'🧱','Couverture / Toiture':'🏠',
    'Jardinage / Espaces verts':'🌿','Nettoyage / Entretien':'🧹',
    'Ascenseur':'🛗','Automatisme / Portail':'🚧','Téléphonie / Réseau':'📡',
    'Multi-services':'🔧',
  }

  if (loading) return <Layout><div className="it-center"><div className="it-spinner"/></div></Layout>

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Prestataires</h1>
          <p className="page-sub">{items.length} prestataire(s)</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm({}); setError(''); setModal({}) }}>+ Ajouter</button>
      </div>

      {/* Filtres */}
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        <input style={{ padding:'7px 12px', border:'1px solid rgba(0,0,0,.15)', borderRadius:8, fontFamily:'inherit', fontSize:13, outline:'none', flex:1, minWidth:160 }}
          placeholder="🔍 Rechercher…" value={search} onChange={e => setSearch(e.target.value)} />
        <select style={{ padding:'7px 12px', border:'1px solid rgba(0,0,0,.15)', borderRadius:8, fontFamily:'inherit', fontSize:13, outline:'none', background:'#fff' }}
          value={filterSpe} onChange={e => setFilterSpe(e.target.value)}>
          <option value="">Toutes spécialités</option>
          {usedSpes.map(s => <option key={s} value={s}>{SPE_ICONS[s]||'🔧'} {s}</option>)}
        </select>
      </div>

      {/* Filtres rapides par spécialité */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:16 }}>
        {usedSpes.map(s => (
          <button key={s} onClick={() => setFilterSpe(filterSpe===s?'':s)}
            className="btn btn-sm"
            style={{ background: filterSpe===s?'#2D5A3D':'#fff', color: filterSpe===s?'#fff':'#1A1714', border:'1px solid rgba(0,0,0,.12)' }}>
            {SPE_ICONS[s]||'🔧'} {s}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="card">
          <div className="card-body" style={{ textAlign:'center', padding:40, color:'#9E9890' }}>
            {items.length === 0 ? 'Aucun prestataire. Ajoutez vos artisans de confiance.' : 'Aucun résultat pour ces filtres.'}
          </div>
        </div>
      )}

      {/* Grille */}
      <div className="grid3" style={{ gap:12 }}>
        {filtered.map(p => (
          <div key={p.id} className="card">
            <div className="card-body" style={{ padding:'16px' }}>
              <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:10 }}>
                <div style={{ width:40, height:40, borderRadius:'50%', background:'#FDF3E7', color:'#C8813A', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
                  {SPE_ICONS[p.specialite] || '🔧'}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:600, fontSize:14, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {p.prenom ? `${p.prenom} ${p.nom}` : p.nom}
                  </div>
                  {p.societe && <div style={{ fontSize:12, color:'#6B6560' }}>{p.societe}</div>}
                </div>
              </div>
              {p.specialite && (
                <span style={{ display:'inline-block', padding:'3px 9px', borderRadius:20, fontSize:11, fontWeight:600, background:'#FDF3E7', color:'#C8813A', marginBottom:8 }}>
                  {SPE_ICONS[p.specialite]||'🔧'} {p.specialite}
                </span>
              )}
              {p.telephone && <div style={{ fontSize:12, color:'#6B6560', marginBottom:3 }}>📞 {p.telephone}</div>}
              {p.email    && <div style={{ fontSize:12, color:'#6B6560', marginBottom:3 }}>✉️ {p.email}</div>}
              {p.notes    && <div style={{ fontSize:11, color:'#9E9890', marginTop:6, lineHeight:1.4 }}>{p.notes}</div>}
              <div style={{ display:'flex', gap:6, marginTop:10 }}>
                <button className="btn btn-secondary btn-sm" style={{ flex:1 }}
                  onClick={() => { setForm(p); setError(''); setModal(p) }}>✏️ Modifier</button>
                <button className="btn btn-danger btn-sm" onClick={() => del(p.id)}>🗑️</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL */}
      {modal !== null && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">{modal.id ? 'Modifier' : 'Nouveau prestataire'}</span>
              <button className="modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error">{error}</div>}

              <div className="grid2">
                <div className="fld"><label>Prénom</label><input value={form.prenom||''} onChange={e=>set('prenom',e.target.value)} /></div>
                <div className="fld"><label>Nom *</label><input value={form.nom||''} onChange={e=>set('nom',e.target.value)} /></div>
              </div>
              <div className="fld"><label>Société / Entreprise</label><input value={form.societe||''} onChange={e=>set('societe',e.target.value)} /></div>
              <div className="grid2">
                <div className="fld"><label>Téléphone</label><input value={form.telephone||''} onChange={e=>set('telephone',e.target.value)} /></div>
                <div className="fld"><label>Email</label><input type="email" value={form.email||''} onChange={e=>set('email',e.target.value)} /></div>
              </div>
              <div className="fld">
                <label>Spécialité</label>
                <select value={form.specialite||''} onChange={e => set('specialite', e.target.value)}>
                  <option value="">— Choisir —</option>
                  {specialites.map(s => <option key={s} value={s}>{SPE_ICONS[s]||'🔧'} {s}</option>)}
                </select>
              </div>
              {/* Ajouter une spécialité custom */}
              <div style={{ display:'flex', gap:6 }}>
                <input style={{ flex:1, padding:'7px 10px', border:'1px solid rgba(0,0,0,.15)', borderRadius:7, fontFamily:'inherit', fontSize:12, outline:'none' }}
                  placeholder="Nouvelle spécialité…" value={newSpe}
                  onChange={e => setNewSpe(e.target.value)}
                  onKeyDown={e => e.key==='Enter' && addSpecialite()} />
                <button className="btn btn-secondary btn-sm" onClick={addSpecialite}>+ Ajouter</button>
              </div>

              <div className="fld"><label>Adresse</label><input value={form.adresse||''} onChange={e=>set('adresse',e.target.value)} /></div>
              <div className="fld"><label>Notes / Observations</label><textarea value={form.notes||''} onChange={e=>set('notes',e.target.value)} /></div>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? 'Enregistrement…' : '💾 Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
