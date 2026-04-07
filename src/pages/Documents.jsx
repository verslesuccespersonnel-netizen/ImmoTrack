import React, { useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { useLoad } from '../lib/useLoad'
import Layout from '../components/Layout'

const TYPES_DOC = ['Bail','Quittance','État des lieux','Assurance','Diagnostic','Règlement','Facture','Autre']

export default function Documents() {
  const { session, profile } = useAuth()
  const [modal, setModal]   = useState(false)
  const [form, setForm]     = useState({nom:'',type:'',bien_id:''})
  const [file, setFile]     = useState(null)
  const [saving, setSaving] = useState(false)
  const [formErr, setFormErr] = useState('')
  const [filterType, setFilter] = useState('')

  const MGR = ['proprietaire','gestionnaire','agence','admin']
  const isOwner = MGR.includes(profile?.role)

  const { data, loading, error, reload } = useLoad(async () => {
    if(!session?.user) return {docs:[], biens:[]}
    const [docsRes, biensRes] = await Promise.all([
      supabase.from('documents').select('*,biens(adresse),profiles!uploaded_by(nom,prenom)').order('created_at',{ascending:false}),
      isOwner ? supabase.from('biens').select('id,adresse').eq('proprietaire_id',session.user.id) : Promise.resolve({data:[]}),
    ])
    return {docs:docsRes.data||[], biens:biensRes.data||[]}
  }, [session?.user?.id, profile?.role])

  function set(k,v){setForm(f=>({...f,[k]:v}))}

  async function upload() {
    if(!form.nom||!file){setFormErr('Nom et fichier requis');return}
    setSaving(true);setFormErr('')
    try {
      const ext=file.name.split('.').pop()
      const path=`docs/${session.user.id}/${Date.now()}.${ext}`
      const {error:upErr}=await supabase.storage.from('documents').upload(path,file)
      if(upErr) throw upErr
      const {data:{publicUrl}}=supabase.storage.from('documents').getPublicUrl(path)
      await supabase.from('documents').insert({nom:form.nom,type:form.type||null,url:publicUrl,bien_id:form.bien_id||null,uploaded_by:session.user.id,favori:false})
      setModal(false);setFile(null);setForm({nom:'',type:'',bien_id:''});reload()
    } catch(e){setFormErr(`Erreur: ${e.message}. Vérifiez que le bucket "documents" existe dans Supabase Storage.`)}
    finally{setSaving(false)}
  }

  async function toggleFavori(doc){
    await supabase.from('documents').update({favori:!doc.favori}).eq('id',doc.id)
    reload()
  }

  async function del(id){if(!window.confirm('Supprimer ?'))return;await supabase.from('documents').delete().eq('id',id);reload()}

  const docs = data?.docs||[]
  const biens = data?.biens||[]
  const filtered = filterType ? docs.filter(d=>d.type===filterType) : docs
  const usedTypes = [...new Set(docs.map(d=>d.type).filter(Boolean))]

  if(loading)return<Layout><div className="it-center"><div className="it-spinner"/></div></Layout>
  if(error)return<Layout><div className="it-center"><div className="alert alert-error">{error}</div></div></Layout>

  return(
    <Layout>
      <div className="page-header">
        <div><h1 className="page-title">Documents</h1><p className="page-sub">{docs.length} document(s) · {docs.filter(d=>d.favori).length} favori(s)</p></div>
        <button className="btn btn-primary" onClick={()=>{setFormErr('');setModal(true)}}>+ Ajouter</button>
      </div>
      {usedTypes.length>0&&<div style={{display:'flex',gap:6,marginBottom:14,flexWrap:'wrap'}}>
        <button className={`btn btn-sm ${!filterType?'btn-primary':'btn-secondary'}`} onClick={()=>setFilter('')}>Tous</button>
        {usedTypes.map(t=><button key={t} className={`btn btn-sm ${filterType===t?'btn-primary':'btn-secondary'}`} onClick={()=>setFilter(t)}>{t}</button>)}
      </div>}
      {filtered.length===0&&<div className="card"><div className="card-body" style={{textAlign:'center',padding:40,color:'#9E9890'}}>Aucun document.</div></div>}
      <div className="grid3" style={{gap:10}}>
        {filtered.map(doc=>(
          <div key={doc.id} className="card">
            <div className="card-body" style={{padding:14}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
                <span style={{fontSize:28}}>{doc.type==='Bail'?'📋':doc.type==='Quittance'?'🧾':doc.type==='Facture'?'💶':'📄'}</span>
                <button onClick={()=>toggleFavori(doc)} style={{background:'none',border:'none',cursor:'pointer',fontSize:18}}>{doc.favori?'⭐':'☆'}</button>
              </div>
              <div style={{fontWeight:600,fontSize:13,marginBottom:3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{doc.nom}</div>
              {doc.type&&<span className="status status-blue" style={{fontSize:10,marginBottom:6,display:'inline-block'}}>{doc.type}</span>}
              {doc.biens?.adresse&&<div style={{fontSize:11,color:'#9E9890',marginBottom:3}}>📍 {doc.biens.adresse}</div>}
              <div style={{fontSize:10,color:'#9E9890',marginBottom:10}}>{new Date(doc.created_at).toLocaleDateString('fr-FR')}</div>
              <div style={{display:'flex',gap:5}}>
                <a href={doc.url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm" style={{flex:1,textAlign:'center'}}>⬇️ Ouvrir</a>
                {doc.uploaded_by===session.user.id&&<button className="btn btn-danger btn-sm" onClick={()=>del(doc.id)}>🗑️</button>}
              </div>
            </div>
          </div>
        ))}
      </div>
      {modal&&<div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModal(false)}>
        <div className="modal">
          <div className="modal-header"><span className="modal-title">Ajouter un document</span><button className="modal-close" onClick={()=>setModal(false)}>✕</button></div>
          <div className="modal-body">
            {formErr&&<div className="alert alert-error">{formErr}</div>}
            <div className="fld"><label>Nom *</label><input value={form.nom} onChange={e=>set('nom',e.target.value)} placeholder="Ex: Bail 2024 Duplex Bordeaux"/></div>
            <div className="grid2">
              <div className="fld"><label>Type</label><select value={form.type} onChange={e=>set('type',e.target.value)}><option value="">—</option>{TYPES_DOC.map(t=><option key={t}>{t}</option>)}</select></div>
              {biens.length>0&&<div className="fld"><label>Bien</label><select value={form.bien_id} onChange={e=>set('bien_id',e.target.value)}><option value="">—</option>{biens.map(b=><option key={b.id} value={b.id}>{b.adresse}</option>)}</select></div>}
            </div>
            <div className="fld"><label>Fichier *</label><input type="file" onChange={e=>setFile(e.target.files[0])} style={{padding:'6px 0',fontFamily:'inherit',fontSize:13}}/></div>
            <div className="alert alert-info" style={{fontSize:12}}>⚠️ Nécessite un bucket "documents" dans Supabase Storage (public ou avec RLS).</div>
            <button className="btn btn-primary" onClick={upload} disabled={saving}>{saving?'Upload…':'📤 Envoyer'}</button>
          </div>
        </div>
      </div>}
    </Layout>
  )
}
