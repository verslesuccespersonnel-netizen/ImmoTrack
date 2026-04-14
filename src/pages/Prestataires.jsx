import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useLoad } from '../lib/useLoad'
import Layout from '../components/Layout'

const SPE_LIST=['Plomberie','Électricité','Chauffage / Climatisation','Serrurerie','Menuiserie / Vitrage','Peinture / Revêtements','Maçonnerie / Carrelage','Couverture / Toiture','Jardinage / Espaces verts','Nettoyage / Entretien','Ascenseur','Automatisme / Portail','Téléphonie / Réseau','Multi-services']
const SPE_ICONS={'Plomberie':'🚰','Électricité':'⚡','Chauffage / Climatisation':'🌡️','Serrurerie':'🔐','Menuiserie / Vitrage':'🪟','Peinture / Revêtements':'🎨','Maçonnerie / Carrelage':'🧱','Couverture / Toiture':'🏠','Jardinage / Espaces verts':'🌿','Nettoyage / Entretien':'🧹','Ascenseur':'🛗','Automatisme / Portail':'🚧','Téléphonie / Réseau':'📡','Multi-services':'🔧'}

export default function Prestataires() {
  const [modal, setModal]   = useState(null)
  const [form, setForm]     = useState({})
  const [saving, setSaving] = useState(false)
  const [formErr, setFormErr] = useState('')
  const [newSpe, setNewSpe] = useState('')
  const [search, setSearch] = useState('')
  const [filterSpe, setFilterSpe] = useState('')

  const { data:items=[], loading, error, reload } = useLoad(async () => {
    const {data} = await supabase.from('prestataires').select('*').order('nom')
    return data || []
  }, [])

  function set(k,v){setForm(f=>({...f,[k]:v}))}
  
  const allSpes=[...new Set([...SPE_LIST,...items.map(p=>p.specialite).filter(Boolean)])].sort()
  const filtered=items.filter(p=>{
    const ms=!search||`${p.nom||''} ${p.prenom||''} ${p.societe||''}`.toLowerCase().includes(search.toLowerCase())
    const mf=!filterSpe||p.specialite===filterSpe
    return ms&&mf
  })

  async function save(){
    if(!form.nom){setFormErr('Nom obligatoire');return}
    setSaving(true);setFormErr('')
    try{
      const pl={nom:form.nom,prenom:form.prenom||null,societe:form.societe||null,telephone:form.telephone||null,email:form.email||null,specialite:form.specialite||null,adresse:form.adresse||null,notes:form.notes||null}
      if(modal.id) await supabase.from('prestataires').update(pl).eq('id',modal.id)
      else await supabase.from('prestataires').insert(pl)
      setModal(null);reload()
    }catch(e){setFormErr(e.message)}
    finally{setSaving(false)}
  }

  async function del(id){if(!window.confirm('Supprimer ?'))return;await supabase.from('prestataires').delete().eq('id',id);reload()}

  if(loading)return<Layout><div className="it-center"><div className="it-spinner"/></div></Layout>
  if(error)return<Layout><div className="it-center"><div className="alert alert-error">{error}</div></div></Layout>

  return(
    <Layout>
      <div className="page-header"><div><h1 className="page-title">Prestataires</h1><p className="page-sub">{items.length} prestataire(s)</p></div><button className="btn btn-primary" onClick={()=>{setForm({});setFormErr('');setModal({})}}>+ Ajouter</button></div>
      <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap'}}>
        <input style={{padding:'7px 12px',border:'1px solid rgba(0,0,0,.15)',borderRadius:8,fontFamily:'inherit',fontSize:13,outline:'none',flex:1,minWidth:160}} placeholder="🔍 Rechercher…" value={search} onChange={e=>setSearch(e.target.value)}/>
        <select style={{padding:'7px 12px',border:'1px solid rgba(0,0,0,.15)',borderRadius:8,fontFamily:'inherit',fontSize:13,outline:'none',background:'#fff'}} value={filterSpe} onChange={e=>setFilterSpe(e.target.value)}>
          <option value="">Toutes spécialités</option>
          {[...new Set(items.map(p=>p.specialite).filter(Boolean))].map(s=><option key={s} value={s}>{SPE_ICONS[s]||'🔧'} {s}</option>)}
        </select>
      </div>
      {filtered.length===0&&<div className="card"><div className="card-body" style={{textAlign:'center',padding:40,color:'#9E9890'}}>Aucun prestataire.</div></div>}
      <div className="grid3" style={{gap:12}}>
        {filtered.map(p=>(
          <div key={p.id} className="card">
            <div className="card-body" style={{padding:14}}>
              <div style={{display:'flex',alignItems:'flex-start',gap:10,marginBottom:8}}>
                <div style={{width:40,height:40,borderRadius:'50%',background:'#FDF3E7',color:'#C8813A',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>{SPE_ICONS[p.specialite]||'🔧'}</div>
                <div style={{flex:1,minWidth:0}}><div style={{fontWeight:600,fontSize:14,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.prenom?`${p.prenom} ${p.nom}`:p.nom}</div>{p.societe&&<div style={{fontSize:12,color:'#6B6560'}}>{p.societe}</div>}</div>
              </div>
              {p.specialite&&<span style={{display:'inline-block',padding:'3px 9px',borderRadius:20,fontSize:11,fontWeight:600,background:'#FDF3E7',color:'#C8813A',marginBottom:8}}>{SPE_ICONS[p.specialite]||'🔧'} {p.specialite}</span>}
              {p.telephone&&<div style={{fontSize:12,color:'#6B6560',marginBottom:2}}>📞 {p.telephone}</div>}
              {p.email&&<div style={{fontSize:12,color:'#6B6560',marginBottom:2}}>✉️ {p.email}</div>}
              {p.notes&&<div style={{fontSize:11,color:'#9E9890',marginTop:5,lineHeight:1.4}}>{p.notes}</div>}
              <div style={{display:'flex',gap:5,marginTop:10}}>
                <button className="btn btn-secondary btn-sm" style={{flex:1}} onClick={()=>{setForm(p);setFormErr('');setModal(p)}}>✏️</button>
                <button className="btn btn-danger btn-sm" onClick={()=>del(p.id)}>🗑️</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {modal!==null&&(
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div className="modal">
            <div className="modal-header"><span className="modal-title">{modal.id?'Modifier':'Nouveau prestataire'}</span><button className="modal-close" onClick={()=>setModal(null)}>✕</button></div>
            <div className="modal-body">
              {formErr&&<div className="alert alert-error">{formErr}</div>}
              <div className="grid2"><div className="fld"><label>Prénom</label><input value={form.prenom||''} onChange={e=>set('prenom',e.target.value)}/></div><div className="fld"><label>Nom *</label><input value={form.nom||''} onChange={e=>set('nom',e.target.value)}/></div></div>
              <div className="fld"><label>Société</label><input value={form.societe||''} onChange={e=>set('societe',e.target.value)}/></div>
              <div className="grid2"><div className="fld"><label>Téléphone</label><input value={form.telephone||''} onChange={e=>set('telephone',e.target.value)}/></div><div className="fld"><label>Email</label><input type="email" value={form.email||''} onChange={e=>set('email',e.target.value)}/></div></div>
              <div className="fld"><label>Spécialité</label>
                <select value={form.specialite||''} onChange={e=>set('specialite',e.target.value)}>
                  <option value="">— Choisir —</option>
                  {allSpes.map(s=><option key={s} value={s}>{SPE_ICONS[s]||'🔧'} {s}</option>)}
                </select>
              </div>
              <div style={{display:'flex',gap:6}}>
                <input style={{flex:1,padding:'7px 10px',border:'1px solid rgba(0,0,0,.15)',borderRadius:7,fontFamily:'inherit',fontSize:12,outline:'none'}} placeholder="Ajouter une spécialité…" value={newSpe} onChange={e=>setNewSpe(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&newSpe.trim()){set('specialite',newSpe.trim());setNewSpe('')}}}/>
                <button className="btn btn-secondary btn-sm" onClick={()=>{if(newSpe.trim()){set('specialite',newSpe.trim());setNewSpe('')}}}>+ Ajouter</button>
              </div>
              <div className="fld"><label>Adresse</label><input value={form.adresse||''} onChange={e=>set('adresse',e.target.value)}/></div>
              <div className="fld"><label>Notes</label><textarea value={form.notes||''} onChange={e=>set('notes',e.target.value)}/></div>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'…':'💾 Enregistrer'}</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
