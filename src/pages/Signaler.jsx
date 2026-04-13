import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

export default function Signaler() {
  const { profile, session } = useAuth()
  const navigate = useNavigate()
  const [biens,  setBiens]  = useState([])
  const [equips, setEquips] = useState([])
  const [form,   setForm]   = useState({ gravite:'moyen' })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  useEffect(() => {
    if (!session?.user || !profile) return
    async function load() {
      const isTenant = profile.role === 'locataire'
      const [bR, eR] = await Promise.all([
        isTenant
          ? supabase.from('locations').select('biens(id,adresse,ville)').eq('locataire_id',session.user.id).eq('statut','actif')
          : supabase.from('biens').select('id,adresse,ville').eq('proprietaire_id',session.user.id),
        supabase.from('catalogue_equipements').select('id,nom,icone,type').order('nom'),
      ])
      setBiens(isTenant ? (bR.data||[]).map(l=>l.biens).filter(Boolean) : (bR.data||[]))
      setEquips(eR.data||[])
    }
    load()
  }, [session?.user?.id, profile?.role])

  function set(k,v) { setForm(f=>({...f,[k]:v})) }

  async function submit(e) {
    e.preventDefault()
    if (!form.bien_id||!form.titre) { setError('Bien et titre requis'); return }
    setSaving(true); setError('')
    try {
      await supabase.from('incidents').insert({
        bien_id:form.bien_id, titre:form.titre, description:form.description||null,
        gravite:form.gravite, statut:'nouveau', signale_par:session.user.id,
        equipement_id:form.equipement_id||null,
      })
      navigate('/incidents')
    } catch(e2) { setError(e2.message); setSaving(false) }
  }

  return (
    <Layout>
      <div className="page-header"><h1 className="page-title">Signaler un incident</h1></div>
      <div className="card" style={{maxWidth:560}}>
        <div className="modal-body" style={{padding:'20px 24px'}}>
          {error && <div className="alert alert-error">{error}</div>}
          <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:14}}>
            <div className="fld"><label>Bien *</label>
              <select value={form.bien_id||''} onChange={e=>set('bien_id',e.target.value)} required>
                <option value="">Choisir</option>
                {biens.map(b=><option key={b.id} value={b.id}>{b.adresse}, {b.ville}</option>)}
              </select>
            </div>
            {equips.length>0 && <div className="fld"><label>Equipement (optionnel)</label>
              <select value={form.equipement_id||''} onChange={e=>set('equipement_id',e.target.value)}>
                <option value="">--</option>
                {equips.map(eq=><option key={eq.id} value={eq.id}>{eq.icone||''} {eq.nom}</option>)}
              </select>
            </div>}
            <div className="fld"><label>Titre *</label>
              <input value={form.titre||''} onChange={e=>set('titre',e.target.value)} placeholder="Ex : volet bloque, fuite robinet"/>
            </div>
            <div className="fld"><label>Description</label>
              <textarea value={form.description||''} onChange={e=>set('description',e.target.value)} placeholder="Depuis quand, frequence, bruit ou visuel ?"/>
            </div>
            <div className="fld"><label>Gravite</label>
              <div style={{display:'flex',gap:8}}>
                {[['faible','Faible'],['moyen','Moyen'],['urgent','Urgent']].map(([v,l])=>(
                  <button type="button" key={v} className="btn btn-sm" onClick={()=>set('gravite',v)}
                    style={{flex:1,background:form.gravite===v?'#2D5A3D':'#fff',color:form.gravite===v?'#fff':'#1A1714',border:`1px solid ${form.gravite===v?'#2D5A3D':'rgba(0,0,0,.15)'}`}}>
                    {v==='faible'?'🟢':v==='moyen'?'🟡':'🔴'} {l}
                  </button>
                ))}
              </div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Envoi...':'Envoyer'}</button>
          </form>
        </div>
      </div>
    </Layout>
  )
}
