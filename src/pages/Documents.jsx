import React, { useEffect, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const TYPES_DOC = ['Bail','Quittance','État des lieux','Assurance','Diagnostic','Règlement','Facture','Autre']

export default function Documents() {
  const { session, profile } = useAuth()
  const [docs, setDocs]         = useState([])
  const [biens, setBiens]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(false)
  const [form, setForm]         = useState({ nom:'', type:'', bien_id:'', partager_avec:'' })
  const [file, setFile]         = useState(null)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [contacts, setContacts] = useState([])
  const [filterType, setFilter] = useState('')

  useEffect(() => { if (session) load() }, [session])

  async function load() {
    setLoading(true)
    const MGR = ['proprietaire','gestionnaire','agence','admin']
    const isOwner = MGR.includes(profile?.role)

    const [docsRes, biensRes, contactsRes] = await Promise.all([
      isOwner
        ? supabase.from('documents').select('*, biens(adresse), profiles!uploaded_by(nom,prenom)').eq('uploaded_by', session.user.id).order('created_at', { ascending:false })
        : supabase.from('documents').select('*, biens(adresse), profiles!uploaded_by(nom,prenom)').order('created_at', { ascending:false }),
      isOwner ? supabase.from('biens').select('id,adresse').eq('proprietaire_id', session.user.id) : Promise.resolve({data:[]}),
      supabase.from('profiles').select('id,nom,prenom,role').neq('id', session.user.id),
    ])

    setDocs(docsRes.data || [])
    setBiens(biensRes.data || [])
    setContacts(contactsRes.data || [])
    setLoading(false)
  }

  function set(k,v) { setForm(f=>({...f,[k]:v})) }

  async function uploadDoc() {
    if (!form.nom || !file) { setError('Nom et fichier requis'); return }
    setSaving(true); setError('')
    try {
      // Upload fichier dans Supabase Storage
      const ext = file.name.split('.').pop()
      const path = `docs/${session.user.id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('documents').upload(path, file)
      if (upErr) throw upErr

      const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path)

      await supabase.from('documents').insert({
        nom: form.nom, type: form.type || null,
        url: publicUrl,
        bien_id: form.bien_id || null,
        uploaded_by: session.user.id,
        favori: false,
      })

      setModal(false); setFile(null); setForm({ nom:'', type:'', bien_id:'', partager_avec:'' })
      await load()
    } catch(e) {
      // Si Storage pas configuré, on sauvegarde avec URL placeholder
      setError(`Upload impossible : ${e.message}. Assurez-vous que le bucket "documents" existe dans Supabase Storage.`)
    }
    setSaving(false)
  }

  async function toggleFavori(doc) {
    await supabase.from('documents').update({ favori: !doc.favori }).eq('id', doc.id)
    setDocs(docs.map(d => d.id===doc.id ? {...d, favori:!d.favori} : d))
  }

  async function delDoc(id) {
    if (!window.confirm('Supprimer ce document ?')) return
    await supabase.from('documents').delete().eq('id', id)
    setDocs(docs.filter(d => d.id!==id))
  }

  const filtered = filterType ? docs.filter(d => d.type===filterType) : docs
  const usedTypes = [...new Set(docs.map(d=>d.type).filter(Boolean))]

  if (loading) return <Layout><div className="it-center"><div className="it-spinner"/></div></Layout>

  return (
    <Layout>
      <div className="page-header">
        <div><h1 className="page-title">Documents</h1><p className="page-sub">{docs.length} document(s) · {docs.filter(d=>d.favori).length} favori(s)</p></div>
        <button className="btn btn-primary" onClick={() => { setError(''); setModal(true) }}>+ Ajouter</button>
      </div>

      {/* Filtres */}
      {usedTypes.length > 0 && (
        <div style={{ display:'flex', gap:6, marginBottom:14, flexWrap:'wrap' }}>
          <button className={`btn btn-sm ${!filterType?'btn-primary':'btn-secondary'}`} onClick={() => setFilter('')}>Tous</button>
          {usedTypes.map(t => <button key={t} className={`btn btn-sm ${filterType===t?'btn-primary':'btn-secondary'}`} onClick={() => setFilter(t)}>{t}</button>)}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="card"><div className="card-body" style={{ textAlign:'center', padding:40, color:'#9E9890' }}>
          Aucun document. Ajoutez vos bail, quittances, diagnostics…
        </div></div>
      )}

      <div className="grid3" style={{ gap:10 }}>
        {filtered.map(doc => (
          <div key={doc.id} className="card">
            <div className="card-body" style={{ padding:'14px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                <span style={{ fontSize:28 }}>
                  {doc.type==='Bail'?'📋':doc.type==='Quittance'?'🧾':doc.type==='État des lieux'?'🏠':doc.type==='Facture'?'💶':'📄'}
                </span>
                <button onClick={() => toggleFavori(doc)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:18 }}>
                  {doc.favori ? '⭐' : '☆'}
                </button>
              </div>
              <div style={{ fontWeight:600, fontSize:13, marginBottom:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{doc.nom}</div>
              {doc.type && <span className="status status-blue" style={{ fontSize:10, marginBottom:6, display:'inline-block' }}>{doc.type}</span>}
              {doc.biens?.adresse && <div style={{ fontSize:11, color:'#9E9890', marginBottom:3 }}>📍 {doc.biens.adresse}</div>}
              <div style={{ fontSize:10, color:'#9E9890', marginBottom:10 }}>{new Date(doc.created_at).toLocaleDateString('fr-FR')}</div>
              <div style={{ display:'flex', gap:5 }}>
                <a href={doc.url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm" style={{ flex:1, textAlign:'center' }}>⬇️ Ouvrir</a>
                {doc.uploaded_by === session.user.id && <button className="btn btn-danger btn-sm" onClick={() => delDoc(doc.id)}>🗑️</button>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL UPLOAD */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">Ajouter un document</span>
              <button className="modal-close" onClick={() => setModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error">{error}</div>}
              <div className="fld"><label>Nom *</label><input value={form.nom} onChange={e=>set('nom',e.target.value)} placeholder="Ex: Bail Duplex Bordeaux 2024" /></div>
              <div className="grid2">
                <div className="fld"><label>Type</label>
                  <select value={form.type} onChange={e=>set('type',e.target.value)}>
                    <option value="">— Choisir —</option>
                    {TYPES_DOC.map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
                {biens.length > 0 && (
                  <div className="fld"><label>Bien associé</label>
                    <select value={form.bien_id} onChange={e=>set('bien_id',e.target.value)}>
                      <option value="">— Aucun —</option>
                      {biens.map(b=><option key={b.id} value={b.id}>{b.adresse}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div className="fld">
                <label>Fichier *</label>
                <input type="file" onChange={e => setFile(e.target.files[0])}
                  style={{ padding:'6px 0', fontFamily:'inherit', fontSize:13 }} />
                <div style={{ fontSize:11, color:'#9E9890', marginTop:3 }}>PDF, images, Word… (max 50 Mo)</div>
              </div>
              <div className="alert alert-info" style={{ fontSize:12 }}>
                ⚠️ Pour l'upload, créez d'abord un bucket "documents" dans Supabase Storage (public ou avec RLS).
              </div>
              <button className="btn btn-primary" onClick={uploadDoc} disabled={saving}>{saving?'Upload…':'📤 Envoyer'}</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
