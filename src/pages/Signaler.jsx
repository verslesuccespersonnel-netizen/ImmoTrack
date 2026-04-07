import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { useLoad } from '../lib/useLoad'
import Layout from '../components/Layout'

export default function Signaler() {
  const { profile, session } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({bien_id:'',titre:'',description:'',gravite:'moyen',equipement_id:''})
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const MGR = ['proprietaire','gestionnaire','agence','admin']

  const { data, loading } = useLoad(async () => {
    if(!session?.user) return {biens:[], equips:[]}
    const [biensRes, equipsRes] = await Promise.all([
      profile?.role==='locataire'
        ? supabase.from('locations').select('biens(id,adresse,ville)').eq('locataire_id',session.user.id).eq('statut','actif')
        : supabase.from('biens').select('id,adresse,ville').eq('proprietaire_id',session.user.id),
      supabase.from('catalogue_equipements').select('id,nom,icone,type').order('nom'),
    ])
    const biens = profile?.role==='locataire'
      ? (biensRes.data||[]).map(l=>l.biens).filter(Boolean)
      : (biensRes.data||[])
    return {biens, equips:equipsRes.data||[]}
  }, [session?.user?.id, profile?.role])

  function set(k,v){setForm(f=>({...f,[k]:v}))}

  async function submit(e) {
    e.preventDefault()
    if(!form.bien_id||!form.titre){setError('Bien et titre requis');return}
    setSaving(true);setError('')
    try {
      await supabase.from('incidents').insert({bien_id:form.bien_id,titre:form.titre,description:form.description,gravite:form.gravite,statut:'nouveau',signale_par:session.user.id,equipement_id:form.equipement_id||null})
      navigate('/incidents')
    } catch(e){setError(e.message);setSaving(false)}
  }

  const biens = data?.biens||[]
  const equips = data?.equips||[]

  if(loading)return<Layout><div className="it-center"><div className="it-spinner"/></div></Layout>

  return(
    <Layout>
      <div className="page-header"><h1 className="page-title">Signaler un incident</h1></div>
      <div className="card" style={{maxWidth:600}}>
        <div className="modal-body" style={{padding:'20px 24px'}}>
          {error&&<div className="alert alert-error">{error}</div>}
          <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:14}}>
            <div className="fld"><label>Bien concerné *</label>
              <select value={form.bien_id} onChange={e=>set('bien_id',e.target.value)} required>
                <option value="">— Choisir —</option>
                {biens.map(b=><option key={b.id} value={b.id}>{b.adresse}, {b.ville}</option>)}
              </select>
            </div>
            {equips.length>0&&<div className="fld"><label>Équipement concerné</label>
              <select value={form.equipement_id} onChange={e=>set('equipement_id',e.target.value)}>
                <option value="">— Sélectionner (optionnel) —</option>
                {equips.map(eq=><option key={eq.id} value={eq.id}>{eq.icone||'🔧'} {eq.nom} ({eq.type})</option>)}
              </select>
            </div>}
            <div className="fld"><label>Titre *</label><input value={form.titre} onChange={e=>set('titre',e.target.value)} placeholder="Ex : Volet roulant bloqué, fuite robinet…" required/></div>
            <div className="fld"><label>Description</label><textarea value={form.description} onChange={e=>set('description',e.target.value)} placeholder="Depuis quand ? Fréquence ? Bruit ou visuel ?"/></div>
            <div className="fld"><label>Gravité</label>
              <div style={{display:'flex',gap:8}}>
                {[['faible','🟢 Faible'],['moyen','🟡 Moyen'],['urgent','🔴 Urgent']].map(([v,l])=>(
                  <button type="button" key={v} className="btn btn-sm" onClick={()=>set('gravite',v)} style={{flex:1,background:form.gravite===v?'#2D5A3D':'#fff',color:form.gravite===v?'#fff':'#1A1714',border:`1px solid ${form.gravite===v?'#2D5A3D':'rgba(0,0,0,.15)'}`}}>{l}</button>
                ))}
              </div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Envoi…':'📤 Envoyer'}</button>
          </form>
        </div>
      </div>
    </Layout>
  )
}
