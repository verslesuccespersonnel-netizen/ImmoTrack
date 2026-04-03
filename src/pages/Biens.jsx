import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const TYPES = ['Appartement','Maison','Studio','Duplex','Local commercial','Bureau','Terrain','Parking','Autre']

export default function Biens() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [biens, setBiens]   = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]   = useState(null)
  const [form, setForm]     = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  useEffect(() => { if (session) load() }, [session])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('biens')
      .select('*, locations(id,statut,loyer_mensuel,date_debut,profiles!locataire_id(nom,prenom,telephone))')
      .eq('proprietaire_id', session.user.id).order('created_at',{ascending:false})
    setBiens(data||[])
    setLoading(false)
  }

  function set(k,v) { setForm(f=>({...f,[k]:v})) }

  async function save() {
    if (!form.adresse||!form.ville) { setError('Adresse et ville requises'); return }
    setSaving(true); setError('')
    try {
      if (modal.id) {
        await supabase.from('biens').update({ adresse:form.adresse, ville:form.ville, code_postal:form.code_postal||null, type_bien:form.type_bien||null, surface_m2:form.surface_m2?Number(form.surface_m2):null, description:form.description||null }).eq('id',modal.id)
      } else {
        await supabase.from('biens').insert({ adresse:form.adresse, ville:form.ville, code_postal:form.code_postal||null, type_bien:form.type_bien||null, surface_m2:form.surface_m2?Number(form.surface_m2):null, description:form.description||null, proprietaire_id:session.user.id })
      }
      setModal(null); await load()
    } catch(e) { setError(e.message) }
    finally { setSaving(false) }
  }

  async function del(id) {
    if (!window.confirm('Supprimer ce bien ?')) return
    await supabase.from('biens').delete().eq('id',id)
    await load()
  }

  if (loading) return <Layout><div className="it-center"><div className="it-spinner"/></div></Layout>

  return (
    <Layout>
      <div className="page-header">
        <div><h1 className="page-title">Mes biens</h1><p className="page-sub">{biens.length} bien(s)</p></div>
        <button className="btn btn-primary" onClick={() => { setForm({}); setModal({}) }}>+ Ajouter un bien</button>
      </div>

      {biens.length===0 && (
        <div className="card"><div className="card-body" style={{ textAlign:'center', padding:40 }}>
          <div style={{ fontSize:48 }}>🏠</div>
          <p style={{ color:'#6B6560', margin:'12px 0' }}>Aucun bien enregistré.</p>
          <button className="btn btn-primary" onClick={() => { setForm({}); setModal({}) }}>+ Ajouter mon premier bien</button>
        </div></div>
      )}

      {biens.map(b => {
        const loc = b.locations?.find(l=>l.statut==='actif')
        return (
          <div key={b.id} className="card" style={{ marginBottom:12 }}>
            <div className="card-header">
              <div>
                <div style={{ fontWeight:600, fontSize:14 }}>{b.adresse}</div>
                <div style={{ fontSize:12, color:'#6B6560' }}>{b.type_bien||'Bien'} · {b.ville}{b.surface_m2?` · ${b.surface_m2} m²`:''}</div>
              </div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/biens/${b.id}/plan`)}>🗺️ Plan</button>
                <button className="btn btn-secondary btn-sm" onClick={() => { setForm({ adresse:b.adresse, ville:b.ville, code_postal:b.code_postal, type_bien:b.type_bien, surface_m2:b.surface_m2, description:b.description }); setModal(b) }}>✏️</button>
                <button className="btn btn-danger btn-sm" onClick={() => del(b.id)}>🗑️</button>
              </div>
            </div>
            <div className="card-body" style={{ paddingTop:12, paddingBottom:12 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                <span className={`status ${loc?'status-green':'status-grey'}`}>{loc?'Occupé':'Vacant'}</span>
                {loc && <span style={{ fontSize:13, color:'#6B6560' }}>👤 {loc.profiles?.prenom} {loc.profiles?.nom} · {Number(loc.loyer_mensuel).toLocaleString('fr-FR')} €/mois</span>}
                {loc?.profiles?.telephone && <span style={{ fontSize:12, color:'#9E9890' }}>{loc.profiles.telephone}</span>}
                {!loc && <span style={{ fontSize:12, color:'#9E9890' }}>Aucun locataire associé</span>}
              </div>
            </div>
          </div>
        )
      })}

      {modal !== null && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">{modal.id?'Modifier le bien':'Nouveau bien'}</span>
              <button className="modal-close" onClick={()=>setModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error">{error}</div>}
              <div className="grid2">
                <div className="fld"><label>Adresse *</label><input value={form.adresse||''} onChange={e=>set('adresse',e.target.value)} /></div>
                <div className="fld"><label>Ville *</label><input value={form.ville||''} onChange={e=>set('ville',e.target.value)} /></div>
              </div>
              <div className="grid2">
                <div className="fld"><label>Code postal</label><input value={form.code_postal||''} onChange={e=>set('code_postal',e.target.value)} /></div>
                <div className="fld"><label>Type</label>
                  <select value={form.type_bien||''} onChange={e=>set('type_bien',e.target.value)}>
                    <option value="">— Choisir —</option>
                    {TYPES.map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="fld"><label>Surface (m²)</label><input type="number" value={form.surface_m2||''} onChange={e=>set('surface_m2',e.target.value)} /></div>
              <div className="fld"><label>Description</label><textarea value={form.description||''} onChange={e=>set('description',e.target.value)} /></div>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'Enregistrement…':'💾 Enregistrer'}</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
