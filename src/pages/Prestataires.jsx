import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

export default function Prestataires() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])
  async function load() { setLoading(true); const {data}=await supabase.from('prestataires').select('*').order('nom'); setItems(data||[]); setLoading(false) }
  function set(k,v) { setForm(f=>({...f,[k]:v})) }

  async function save() {
    setSaving(true)
    if (modal.id) await supabase.from('prestataires').update({nom:form.nom,prenom:form.prenom,societe:form.societe,telephone:form.telephone,email:form.email,specialite:form.specialite,notes:form.notes}).eq('id',modal.id)
    else await supabase.from('prestataires').insert({nom:form.nom,prenom:form.prenom,societe:form.societe,telephone:form.telephone,email:form.email,specialite:form.specialite,notes:form.notes})
    setSaving(false); setModal(null); await load()
  }

  if (loading) return <Layout><div className="it-center"><div className="it-spinner"/></div></Layout>
  return (
    <Layout>
      <div className="page-header"><div><h1 className="page-title">Prestataires</h1></div><button className="btn btn-primary" onClick={()=>{setForm({});setModal({})}}>+ Ajouter</button></div>
      {items.map(p=>(
        <div key={p.id} className="card" style={{marginBottom:10}}>
          <div className="row-item">
            <div style={{width:36,height:36,borderRadius:'50%',background:'#FDF3E7',color:'#C8813A',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,flexShrink:0}}>{p.prenom?.[0]||''}{p.nom?.[0]||''}</div>
            <div style={{flex:1}}><div style={{fontWeight:500,fontSize:13}}>{p.prenom} {p.nom}{p.societe?` (${p.societe})`:''}</div><div style={{fontSize:11,color:'#9E9890'}}>{p.specialite}{p.telephone?` · ${p.telephone}`:''}</div></div>
            <button className="btn btn-secondary btn-sm" onClick={()=>{setForm(p);setModal(p)}}>✏️</button>
          </div>
        </div>
      ))}
      {modal&&(
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div className="modal"><div className="modal-header"><span className="modal-title">{modal.id?'Modifier':'Nouveau prestataire'}</span><button className="modal-close" onClick={()=>setModal(null)}>✕</button></div>
          <div className="modal-body">
            <div className="grid2"><div className="fld"><label>Prénom</label><input value={form.prenom||''} onChange={e=>set('prenom',e.target.value)}/></div><div className="fld"><label>Nom *</label><input value={form.nom||''} onChange={e=>set('nom',e.target.value)}/></div></div>
            <div className="fld"><label>Société</label><input value={form.societe||''} onChange={e=>set('societe',e.target.value)}/></div>
            <div className="grid2"><div className="fld"><label>Téléphone</label><input value={form.telephone||''} onChange={e=>set('telephone',e.target.value)}/></div><div className="fld"><label>Email</label><input type="email" value={form.email||''} onChange={e=>set('email',e.target.value)}/></div></div>
            <div className="fld"><label>Spécialité</label><input value={form.specialite||''} onChange={e=>set('specialite',e.target.value)} placeholder="Plomberie, Électricité, Serrurerie…"/></div>
            <div className="fld"><label>Notes</label><textarea value={form.notes||''} onChange={e=>set('notes',e.target.value)}/></div>
            <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'…':'💾 Enregistrer'}</button>
          </div></div>
        </div>
      )}
    </Layout>
  )
}
