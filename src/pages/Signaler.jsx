import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

export default function Signaler() {
  const { profile, session } = useAuth()
  const navigate = useNavigate()
  const [biens, setBiens]   = useState([])
  const [equips, setEquips] = useState([])
  const [form, setForm]     = useState({ bien_id:'', titre:'', description:'', gravite:'moyen', equipement:'' })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  useEffect(() => {
    if (!session) return
    if (profile?.role === 'locataire') {
      supabase.from('locations').select('biens(id,adresse,ville)').eq('locataire_id',session.user.id).eq('statut','actif')
        .then(({data}) => setBiens((data||[]).map(l=>l.biens).filter(Boolean)))
    } else {
      supabase.from('biens').select('id,adresse,ville').eq('proprietaire_id',session.user.id)
        .then(({data}) => setBiens(data||[]))
    }
    supabase.from('catalogue_equipements').select('id,nom,icone,type').order('nom')
      .then(({data}) => setEquips(data||[]))
  }, [session, profile])

  function set(k,v) { setForm(f=>({...f,[k]:v})) }

  async function submit(e) {
    e.preventDefault()
    if (!form.bien_id || !form.titre) { setError('Bien et titre requis'); return }
    setSaving(true); setError('')
    try {
      await supabase.from('incidents').insert({
        bien_id: form.bien_id, titre: form.titre, description: form.description,
        gravite: form.gravite, statut: 'nouveau', signale_par: session.user.id,
        equipement_id: form.equipement||null,
      })
      navigate('/incidents')
    } catch(e) { setError(e.message); setSaving(false) }
  }

  return (
    <Layout>
      <div className="page-header">
        <div><h1 className="page-title">Signaler un incident</h1></div>
      </div>
      <div className="card" style={{ maxWidth:600 }}>
        <div className="modal-body" style={{ padding:'20px 24px' }}>
          {error && <div className="alert alert-error">{error}</div>}
          <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div className="fld">
              <label>Bien concerné *</label>
              <select value={form.bien_id} onChange={e=>set('bien_id',e.target.value)} required>
                <option value="">— Choisir un bien —</option>
                {biens.map(b=><option key={b.id} value={b.id}>{b.adresse}, {b.ville}</option>)}
              </select>
            </div>
            <div className="fld">
              <label>Équipement / Élément concerné</label>
              <select value={form.equipement} onChange={e=>set('equipement',e.target.value)}>
                <option value="">— Sélectionner (optionnel) —</option>
                {equips.map(eq=><option key={eq.id} value={eq.id}>{eq.icone||'🔧'} {eq.nom} ({eq.type})</option>)}
              </select>
            </div>
            <div className="fld">
              <label>Titre du problème *</label>
              <input value={form.titre} onChange={e=>set('titre',e.target.value)} placeholder="Ex : Volet roulant bloqué, Fuite robinet…" required />
            </div>
            <div className="fld">
              <label>Description détaillée</label>
              <textarea value={form.description} onChange={e=>set('description',e.target.value)} placeholder="Depuis quand ? Fréquence ? Bruit ou visuel ?" />
            </div>
            <div className="fld">
              <label>Gravité</label>
              <div style={{ display:'flex', gap:8 }}>
                {[['faible','🟢 Faible'],['moyen','🟡 Moyen'],['urgent','🔴 Urgent']].map(([v,l])=>(
                  <button type="button" key={v} className="btn btn-sm" onClick={()=>set('gravite',v)}
                    style={{ flex:1, background: form.gravite===v?'#2D5A3D':'#fff', color: form.gravite===v?'#fff':'#1A1714', border:`1px solid ${form.gravite===v?'#2D5A3D':'rgba(0,0,0,.15)'}` }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Envoi…':'📤 Envoyer le signalement'}</button>
          </form>
        </div>
      </div>
    </Layout>
  )
}
