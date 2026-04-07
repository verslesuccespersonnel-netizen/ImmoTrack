import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { useLoad } from '../lib/useLoad'
import Layout from '../components/Layout'

const TYPES = ['Appartement','Maison','Studio','Duplex','Local commercial','Bureau','Terrain','Parking','Autre']
const CONTRATS = ['bail_vide','bail_meuble','bail_commercial','courte_duree','colocation','autre']

export default function Biens() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [modal, setModal]   = useState(null)
  const [attrib, setAttrib] = useState(null)
  const [form, setForm]     = useState({})
  const [saving, setSaving] = useState(false)
  const [formErr, setFormErr] = useState('')

  const { data, loading, error, reload } = useLoad(async () => {
    if (!session?.user) return { biens: [], locataires: [] }
    const [biensRes, locsRes] = await Promise.all([
      supabase.from('biens')
        .select('*, locations(id,statut,loyer_mensuel,date_debut,type_contrat,profiles!locataire_id(id,nom,prenom,telephone))')
        .eq('proprietaire_id', session.user.id)
        .order('created_at', { ascending: false }),
      supabase.from('profiles')
        .select('id,nom,prenom,telephone')
        .eq('role', 'locataire'),
    ])
    return { biens: biensRes.data||[], locataires: locsRes.data||[] }
  }, [session?.user?.id])

  function set(k,v) { setForm(f=>({...f,[k]:v})) }

  async function saveBien() {
    if (!form.adresse||!form.ville) { setFormErr('Adresse et ville requises'); return }
    setSaving(true); setFormErr('')
    try {
      if (modal.id) {
        await supabase.from('biens').update({ adresse:form.adresse, ville:form.ville, code_postal:form.code_postal||null, type_bien:form.type_bien||null, surface_m2:form.surface_m2?Number(form.surface_m2):null }).eq('id',modal.id)
      } else {
        await supabase.from('biens').insert({ adresse:form.adresse, ville:form.ville, code_postal:form.code_postal||null, type_bien:form.type_bien||null, surface_m2:form.surface_m2?Number(form.surface_m2):null, proprietaire_id:session.user.id })
      }
      setModal(null); reload()
    } catch(e) { setFormErr(e.message) }
    finally { setSaving(false) }
  }

  async function attribuer() {
    if (!form.loc_id||!form.loyer||!form.date_debut) { setFormErr('Locataire, loyer et date requis'); return }
    setSaving(true); setFormErr('')
    try {
      const locActive = attrib.locations?.find(l=>l.statut==='actif')
      if (locActive) await supabase.from('locations').update({ statut:'termine', date_fin:new Date().toISOString().split('T')[0] }).eq('id',locActive.id)
      await supabase.from('locations').insert({ bien_id:attrib.id, locataire_id:form.loc_id, loyer_mensuel:Number(form.loyer), date_debut:form.date_debut, date_fin:form.date_fin||null, type_contrat:form.type_contrat||null, statut:'actif' })
      setAttrib(null); reload()
    } catch(e) { setFormErr(e.message) }
    finally { setSaving(false) }
  }

  async function retirer(locationId) {
    if (!window.confirm('Terminer cette location ?')) return
    await supabase.from('locations').update({ statut:'termine', date_fin:new Date().toISOString().split('T')[0] }).eq('id',locationId)
    reload()
  }

  async function delBien(id) {
    if (!window.confirm('Supprimer ce bien ?')) return
    await supabase.from('biens').delete().eq('id',id)
    reload()
  }

  const biens = data?.biens || []
  const locataires = data?.locataires || []

  if (loading) return <Layout><div className="it-center"><div className="it-spinner"/></div></Layout>
  if (error)   return <Layout><div className="it-center"><div className="alert alert-error">{error}<br/><button className="btn btn-secondary btn-sm" style={{marginTop:8}} onClick={reload}>↺ Réessayer</button></div></div></Layout>

  return (
    <Layout>
      <div className="page-header">
        <div><h1 className="page-title">Mes biens</h1><p className="page-sub">{biens.length} bien(s) · {biens.filter(b=>b.locations?.some(l=>l.statut==='actif')).length} occupé(s)</p></div>
        <button className="btn btn-primary" onClick={()=>{setForm({});setFormErr('');setModal({})}}>+ Ajouter un bien</button>
      </div>

      {biens.length===0 && <div className="card"><div className="card-body" style={{textAlign:'center',padding:40}}><div style={{fontSize:48}}>🏠</div><p style={{color:'#6B6560',margin:'12px 0'}}>Aucun bien.</p><button className="btn btn-primary" onClick={()=>{setForm({});setModal({})}}>+ Ajouter</button></div></div>}

      {biens.map(b => {
        const locsActives = (b.locations||[]).filter(l=>l.statut==='actif')
        return (
          <div key={b.id} className="card" style={{marginBottom:12}}>
            <div className="card-header">
              <div>
                <div style={{fontWeight:600,fontSize:15}}>{b.adresse}</div>
                <div style={{fontSize:12,color:'#6B6560'}}>{b.type_bien||'Bien'} · {b.ville}{b.code_postal?` ${b.code_postal}`:''}{b.surface_m2?` · ${b.surface_m2} m²`:''}</div>
              </div>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                <button className="btn btn-secondary btn-sm" onClick={()=>navigate(`/biens/${b.id}/plan`)}>🗺️ Plan</button>
                <button className="btn btn-secondary btn-sm" onClick={()=>{setFormErr('');setAttrib(b);setForm({})}}>+ Locataire</button>
                <button className="btn btn-secondary btn-sm" onClick={()=>{setForm({adresse:b.adresse,ville:b.ville,code_postal:b.code_postal,type_bien:b.type_bien,surface_m2:b.surface_m2});setFormErr('');setModal(b)}}>✏️</button>
                <button className="btn btn-danger btn-sm" onClick={()=>delBien(b.id)}>🗑️</button>
              </div>
            </div>
            <div className="card-body" style={{paddingTop:10,paddingBottom:12}}>
              {locsActives.length===0 ? (
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <span className="status status-grey">Vacant</span>
                  <button className="btn btn-secondary btn-sm" onClick={()=>{setFormErr('');setAttrib(b);setForm({})}}>+ Attribuer</button>
                </div>
              ) : (
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {locsActives.map(loc=>(
                    <div key={loc.id} style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
                      <span className="status status-green">Occupé</span>
                      {loc.profiles ? (
                        <span onClick={()=>navigate('/locataires')} style={{fontSize:13,color:'#2D5A3D',fontWeight:500,cursor:'pointer',textDecoration:'underline dotted'}}>
                          👤 {loc.profiles.prenom} {loc.profiles.nom}
                        </span>
                      ) : <span style={{fontSize:12,color:'#9E9890'}}>⚠️ Compte en attente</span>}
                      {loc.profiles?.telephone && <span style={{fontSize:12,color:'#9E9890'}}>{loc.profiles.telephone}</span>}
                      <span style={{fontSize:12,color:'#6B6560'}}>{Number(loc.loyer_mensuel).toLocaleString('fr-FR')} €/mois</span>
                      <button className="btn btn-danger btn-xs" onClick={()=>retirer(loc.id)}>Retirer</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })}

      {modal!==null && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div className="modal">
            <div className="modal-header"><span className="modal-title">{modal.id?'Modifier':'Nouveau bien'}</span><button className="modal-close" onClick={()=>setModal(null)}>✕</button></div>
            <div className="modal-body">
              {formErr && <div className="alert alert-error">{formErr}</div>}
              <div className="grid2"><div className="fld"><label>Adresse *</label><input value={form.adresse||''} onChange={e=>set('adresse',e.target.value)}/></div><div className="fld"><label>Ville *</label><input value={form.ville||''} onChange={e=>set('ville',e.target.value)}/></div></div>
              <div className="grid2"><div className="fld"><label>Code postal</label><input value={form.code_postal||''} onChange={e=>set('code_postal',e.target.value)}/></div><div className="fld"><label>Type</label><select value={form.type_bien||''} onChange={e=>set('type_bien',e.target.value)}><option value="">—</option>{TYPES.map(t=><option key={t}>{t}</option>)}</select></div></div>
              <div className="fld"><label>Surface (m²)</label><input type="number" value={form.surface_m2||''} onChange={e=>set('surface_m2',e.target.value)}/></div>
              <button className="btn btn-primary" onClick={saveBien} disabled={saving}>{saving?'…':'💾 Enregistrer'}</button>
            </div>
          </div>
        </div>
      )}

      {attrib && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setAttrib(null)}>
          <div className="modal">
            <div className="modal-header"><span className="modal-title">Attribuer — {attrib.adresse}</span><button className="modal-close" onClick={()=>setAttrib(null)}>✕</button></div>
            <div className="modal-body">
              {formErr && <div className="alert alert-error">{formErr}</div>}
              <div className="fld"><label>Locataire *</label>
                <select value={form.loc_id||''} onChange={e=>set('loc_id',e.target.value)}>
                  <option value="">— Choisir —</option>
                  {locataires.map(l=><option key={l.id} value={l.id}>{l.prenom} {l.nom}{l.telephone?` · ${l.telephone}`:''}</option>)}
                </select>
              </div>
              <div className="grid2"><div className="fld"><label>Loyer HC (€) *</label><input type="number" value={form.loyer||''} onChange={e=>set('loyer',e.target.value)}/></div><div className="fld"><label>Date d'entrée *</label><input type="date" value={form.date_debut||''} onChange={e=>set('date_debut',e.target.value)}/></div></div>
              <div className="grid2"><div className="fld"><label>Date de sortie</label><input type="date" value={form.date_fin||''} onChange={e=>set('date_fin',e.target.value)}/></div><div className="fld"><label>Type contrat</label><select value={form.type_contrat||''} onChange={e=>set('type_contrat',e.target.value)}><option value="">—</option>{CONTRATS.map(v=><option key={v} value={v}>{v.replace(/_/g,' ')}</option>)}</select></div></div>
              <button className="btn btn-primary" onClick={attribuer} disabled={saving}>{saving?'…':'👤 Attribuer'}</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
