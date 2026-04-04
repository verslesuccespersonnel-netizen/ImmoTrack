import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const TYPES = ['Appartement','Maison','Studio','Duplex','Local commercial','Bureau','Terrain','Parking','Autre']

export default function Biens() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [biens, setBiens]           = useState([])
  const [locatairesLibres, setLocs] = useState([]) // locataires sans location active
  const [loading, setLoading]       = useState(true)
  const [modal, setModal]           = useState(null)
  const [form, setForm]             = useState({})
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')
  const [attribModal, setAttrib]    = useState(null) // bien sur lequel attribuer

  useEffect(() => { if (session) load() }, [session])

  async function load() {
    setLoading(true)
    const [biensRes, locsRes, assignedRes] = await Promise.all([
      supabase.from('biens')
        .select('*, locations(id, statut, loyer_mensuel, date_debut, profiles!locataire_id(id, nom, prenom, telephone))')
        .eq('proprietaire_id', session.user.id)
        .order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, nom, prenom, telephone').eq('role', 'locataire'),
      supabase.from('locations').select('locataire_id').eq('statut', 'actif'),
    ])
    setBiens(biensRes.data || [])
    // Locataires sans location active en premier
    const assignedIds = new Set((assignedRes.data||[]).map(l => l.locataire_id).filter(Boolean))
    const sorted = (locsRes.data||[]).sort((a,b) => {
      const aFree = !assignedIds.has(a.id), bFree = !assignedIds.has(b.id)
      if (aFree && !bFree) return -1
      if (!aFree && bFree) return 1
      return `${a.nom}`.localeCompare(b.nom)
    }).map(l => ({ ...l, assigned: assignedIds.has(l.id) }))
    setLocs(sorted)
    setLoading(false)
  }

  function set(k,v) { setForm(f=>({...f,[k]:v})) }

  async function saveBien() {
    if (!form.adresse || !form.ville) { setError('Adresse et ville requises'); return }
    setSaving(true); setError('')
    try {
      if (modal.id) {
        await supabase.from('biens').update({ adresse:form.adresse, ville:form.ville, code_postal:form.code_postal||null, type_bien:form.type_bien||null, surface_m2:form.surface_m2?Number(form.surface_m2):null }).eq('id', modal.id)
      } else {
        await supabase.from('biens').insert({ adresse:form.adresse, ville:form.ville, code_postal:form.code_postal||null, type_bien:form.type_bien||null, surface_m2:form.surface_m2?Number(form.surface_m2):null, proprietaire_id:session.user.id })
      }
      setModal(null); await load()
    } catch(e) { setError(e.message) }
    finally { setSaving(false) }
  }

  async function attribuerLocataire() {
    if (!form.loc_id || !form.loyer || !form.date_debut) { setError('Locataire, loyer et date requis'); return }
    setSaving(true); setError('')
    try {
      // Terminer l'ancienne location active si existe
      const locActive = attribModal.locations?.find(l => l.statut === 'actif')
      if (locActive) {
        await supabase.from('locations').update({ statut:'termine', date_fin: new Date().toISOString().split('T')[0] }).eq('id', locActive.id)
      }
      await supabase.from('locations').insert({
        bien_id: attribModal.id,
        locataire_id: form.loc_id,
        loyer_mensuel: Number(form.loyer),
        date_debut: form.date_debut,
        date_fin: form.date_fin || null,
        type_contrat: form.type_contrat || null,
        statut: 'actif',
      })
      setAttrib(null); await load()
    } catch(e) { setError(e.message) }
    finally { setSaving(false) }
  }

  async function retirerLocataire(locationId) {
    if (!window.confirm('Retirer ce locataire du bien ?')) return
    await supabase.from('locations').update({ statut:'termine', date_fin: new Date().toISOString().split('T')[0] }).eq('id', locationId)
    await load()
  }

  async function delBien(id) {
    if (!window.confirm('Supprimer ce bien ?')) return
    await supabase.from('biens').delete().eq('id', id)
    await load()
  }

  if (loading) return <Layout><div className="it-center"><div className="it-spinner"/></div></Layout>

  return (
    <Layout>
      <div className="page-header">
        <div><h1 className="page-title">Mes biens</h1><p className="page-sub">{biens.length} bien(s)</p></div>
        <button className="btn btn-primary" onClick={() => { setForm({}); setError(''); setModal({}) }}>+ Ajouter un bien</button>
      </div>

      {biens.length === 0 && (
        <div className="card"><div className="card-body" style={{ textAlign:'center', padding:40 }}>
          <div style={{ fontSize:48 }}>🏠</div>
          <p style={{ color:'#6B6560', margin:'12px 0' }}>Aucun bien.</p>
          <button className="btn btn-primary" onClick={() => { setForm({}); setModal({}) }}>+ Ajouter</button>
        </div></div>
      )}

      {biens.map(b => {
        const locsActives = (b.locations || []).filter(l => l.statut === 'actif')
        return (
          <div key={b.id} className="card" style={{ marginBottom:12 }}>
            {/* En-tête bien */}
            <div className="card-header">
              <div>
                <div style={{ fontWeight:600, fontSize:15 }}>{b.adresse}</div>
                <div style={{ fontSize:12, color:'#6B6560' }}>{b.type_bien||'Bien'} · {b.ville}{b.code_postal?` ${b.code_postal}`:''}{b.surface_m2?` · ${b.surface_m2} m²`:''}</div>
              </div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/biens/${b.id}/plan`)}>🗺️ Plan</button>
                <button className="btn btn-secondary btn-sm" onClick={() => { setError(''); setAttrib(b); setForm({}) }}>+ Locataire</button>
                <button className="btn btn-secondary btn-sm" onClick={() => { setForm({ adresse:b.adresse, ville:b.ville, code_postal:b.code_postal, type_bien:b.type_bien, surface_m2:b.surface_m2 }); setError(''); setModal(b) }}>✏️</button>
                <button className="btn btn-danger btn-sm" onClick={() => delBien(b.id)}>🗑️</button>
              </div>
            </div>

            {/* Locataires actifs */}
            <div className="card-body" style={{ paddingTop:10, paddingBottom:10 }}>
              {locsActives.length === 0 ? (
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span className="status status-grey">Vacant</span>
                  <button className="btn btn-secondary btn-sm" onClick={() => { setError(''); setAttrib(b); setForm({}) }}>+ Attribuer un locataire</button>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {locsActives.map(loc => (
                    <div key={loc.id} style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                      <span className="status status-green">Occupé</span>
                      {loc.profiles ? (
                        <span
                          onClick={() => navigate('/locataires')}
                          style={{ fontSize:13, color:'#2D5A3D', fontWeight:500, cursor:'pointer', textDecoration:'underline', textDecorationStyle:'dotted' }}>
                          👤 {loc.profiles.prenom} {loc.profiles.nom}
                        </span>
                      ) : (
                        <span style={{ fontSize:12, color:'#9E9890' }}>⚠️ Locataire sans compte</span>
                      )}
                      {loc.profiles?.telephone && <span style={{ fontSize:12, color:'#9E9890' }}>{loc.profiles.telephone}</span>}
                      <span style={{ fontSize:12, color:'#6B6560' }}>{Number(loc.loyer_mensuel).toLocaleString('fr-FR')} €/mois</span>
                      <span style={{ fontSize:11, color:'#9E9890' }}>depuis {new Date(loc.date_debut).toLocaleDateString('fr-FR')}</span>
                      <button className="btn btn-danger btn-xs" onClick={() => retirerLocataire(loc.id)}>Retirer</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })}

      {/* MODAL BIEN */}
      {modal !== null && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">{modal.id ? 'Modifier' : 'Nouveau bien'}</span>
              <button className="modal-close" onClick={() => setModal(null)}>✕</button>
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
              <button className="btn btn-primary" onClick={saveBien} disabled={saving}>{saving?'…':'💾 Enregistrer'}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ATTRIBUTION LOCATAIRE */}
      {attribModal && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setAttrib(null)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">Attribuer un locataire — {attribModal.adresse}</span>
              <button className="modal-close" onClick={() => setAttrib(null)}>✕</button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error">{error}</div>}
              <div className="fld">
                <label>Locataire *</label>
                <select value={form.loc_id||''} onChange={e=>set('loc_id',e.target.value)}>
                  <option value="">— Choisir —</option>
                  {locatairesLibres.map(l => (
                    <option key={l.id} value={l.id}>
                      {l.assigned ? '⚠️ ' : '✅ '}{l.prenom} {l.nom}{l.telephone ? ` · ${l.telephone}` : ''}
                    </option>
                  ))}
                </select>
                <div style={{ fontSize:11, color:'#9E9890', marginTop:4 }}>✅ = disponible · ⚠️ = déjà dans un autre bien</div>
              </div>
              <div className="grid2">
                <div className="fld"><label>Loyer mensuel HC (€) *</label><input type="number" value={form.loyer||''} onChange={e=>set('loyer',e.target.value)} /></div>
                <div className="fld"><label>Date d'entrée *</label><input type="date" value={form.date_debut||''} onChange={e=>set('date_debut',e.target.value)} /></div>
              </div>
              <div className="grid2">
                <div className="fld"><label>Date de sortie prévue</label><input type="date" value={form.date_fin||''} onChange={e=>set('date_fin',e.target.value)} /></div>
                <div className="fld"><label>Type de contrat</label>
                  <select value={form.type_contrat||''} onChange={e=>set('type_contrat',e.target.value)}>
                    <option value="">— Choisir —</option>
                    {['bail_vide','bail_meuble','bail_commercial','courte_duree','colocation','autre'].map(v=><option key={v} value={v}>{v.replace('_',' ')}</option>)}
                  </select>
                </div>
              </div>
              <button className="btn btn-primary" onClick={attribuerLocataire} disabled={saving}>{saving?'…':'👤 Attribuer'}</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
