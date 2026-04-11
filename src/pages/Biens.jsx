import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const TYPES = ['Appartement','Maison','Studio','Duplex','Local commercial','Bureau','Terrain','Parking','Autre']

export default function Biens() {
  const { session, profile } = useAuth()
  const navigate = useNavigate()
  const [biens,      setBiens]     = useState([])
  const [locataires, setLocataires] = useState([])
  const [loading,    setLoading]   = useState(true)
  const [error,      setError]     = useState(null)
  const [modal,      setModal]     = useState(null)
  const [attrib,     setAttrib]    = useState(null)
  const [form,       setForm]      = useState({})
  const [saving,     setSaving]    = useState(false)
  const [formErr,    setFormErr]   = useState('')

  const load = useCallback(async () => {
    if (!session?.user || !profile) return
    setLoading(true)
    setError(null)
    try {
      const isAdmin = profile.role === 'admin'
      const [biensRes, locsRes] = await Promise.all([
        isAdmin
          ? supabase.from('biens').select('*, locations(id,statut,loyer_mensuel,date_debut,type_contrat,profiles!locataire_id(id,nom,prenom,telephone))').order('created_at', { ascending: false })
          : supabase.from('biens').select('*, locations(id,statut,loyer_mensuel,date_debut,type_contrat,profiles!locataire_id(id,nom,prenom,telephone))').eq('proprietaire_id', session.user.id).order('created_at', { ascending: false }),
        supabase.from('profiles').select('id,nom,prenom,telephone,role').eq('role', 'locataire'),
      ])
      setBiens(biensRes.data || [])
      setLocataires(locsRes.data || [])
    } catch(e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [session?.user?.id, profile?.role])

  useEffect(() => { load() }, [load])

  function set(k, v) { setForm(f => ({...f, [k]: v})) }

  async function saveBien() {
    if (!form.adresse || !form.ville) { setFormErr('Adresse et ville requises'); return }
    setSaving(true); setFormErr('')
    try {
      if (modal.id) {
        await supabase.from('biens').update({
          adresse: form.adresse, ville: form.ville,
          code_postal: form.code_postal || null,
          type_bien: form.type_bien || null,
          surface_m2: form.surface_m2 ? Number(form.surface_m2) : null,
        }).eq('id', modal.id)
      } else {
        await supabase.from('biens').insert({
          adresse: form.adresse, ville: form.ville,
          code_postal: form.code_postal || null,
          type_bien: form.type_bien || null,
          surface_m2: form.surface_m2 ? Number(form.surface_m2) : null,
          proprietaire_id: session.user.id,
        })
      }
      setModal(null)
      await load()
    } catch(e) {
      setFormErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function attribuer() {
    if (!form.loc_id || !form.loyer || !form.date_debut) {
      setFormErr('Locataire, loyer et date requis')
      return
    }
    setSaving(true); setFormErr('')
    try {
      const locActive = attrib.locations?.find(l => l.statut === 'actif')
      if (locActive) {
        await supabase.from('locations').update({
          statut: 'termine',
          date_fin: new Date().toISOString().split('T')[0],
        }).eq('id', locActive.id)
      }
      await supabase.from('locations').insert({
        bien_id: attrib.id,
        locataire_id: form.loc_id,
        loyer_mensuel: Number(form.loyer),
        date_debut: form.date_debut,
        date_fin: form.date_fin || null,
        type_contrat: form.type_contrat || null,
        statut: 'actif',
      })
      setAttrib(null)
      await load()
    } catch(e) {
      setFormErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function retirer(locationId) {
    if (!window.confirm('Terminer cette location ?')) return
    await supabase.from('locations').update({
      statut: 'termine',
      date_fin: new Date().toISOString().split('T')[0],
    }).eq('id', locationId)
    await load()
  }

  async function delBien(id) {
    if (!window.confirm('Supprimer ce bien ?')) return
    try {
      const { error: e } = await supabase.from('biens').delete().eq('id', id)
      if (e) throw e
    } catch(e) {
      alert('Erreur : ' + e.message)
    }
    await load()
  }

  if (loading) return <Layout><div className="it-center"><div className="it-spinner"/></div></Layout>
  if (error)   return (
    <Layout>
      <div className="it-center">
        <div className="alert alert-error" style={{maxWidth:360, textAlign:'center'}}>
          {error}<br/>
          <button className="btn btn-secondary btn-sm" style={{marginTop:8}} onClick={load}>Reessayer</button>
        </div>
      </div>
    </Layout>
  )

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Mes biens</h1>
          <p className="page-sub">
            {biens.length} bien(s) -{' '}
            {biens.filter(b => b.locations?.some(l => l.statut === 'actif')).length} occupe(s)
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm({}); setFormErr(''); setModal({}) }}>
          + Ajouter un bien
        </button>
      </div>

      {biens.length === 0 && (
        <div className="card">
          <div className="card-body" style={{textAlign:'center', padding:40}}>
            <div style={{fontSize:48}}>🏠</div>
            <p style={{color:'#6B6560', margin:'12px 0'}}>Aucun bien enregistre.</p>
            <button className="btn btn-primary" onClick={() => { setForm({}); setModal({}) }}>
              + Ajouter
            </button>
          </div>
        </div>
      )}

      {biens.map(b => {
        const locsActives = (b.locations || []).filter(l => l.statut === 'actif')
        return (
          <div key={b.id} className="card" style={{marginBottom:12}}>
            <div className="card-header">
              <div>
                <div style={{fontWeight:600, fontSize:15}}>{b.adresse}</div>
                <div style={{fontSize:12, color:'#6B6560'}}>
                  {b.type_bien || 'Bien'} - {b.ville}
                  {b.code_postal ? ' ' + b.code_postal : ''}
                  {b.surface_m2 ? ' - ' + b.surface_m2 + ' m2' : ''}
                </div>
              </div>
              <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
                <button className="btn btn-secondary btn-sm" onClick={() => navigate('/biens/' + b.id + '/plan')}>
                  Plan
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => {
                  setFormErr('')
                  setAttrib(b)
                  setForm({})
                }}>
                  + Locataire
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => {
                  setForm({
                    adresse: b.adresse, ville: b.ville,
                    code_postal: b.code_postal,
                    type_bien: b.type_bien,
                    surface_m2: b.surface_m2,
                  })
                  setFormErr('')
                  setModal(b)
                }}>
                  Modifier
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => delBien(b.id)}>
                  Supprimer
                </button>
              </div>
            </div>

            <div className="card-body" style={{paddingTop:10, paddingBottom:12}}>
              {locsActives.length === 0 ? (
                <div style={{display:'flex', alignItems:'center', gap:10}}>
                  <span className="status status-grey">Vacant</span>
                  <button className="btn btn-secondary btn-sm" onClick={() => {
                    setFormErr('')
                    setAttrib(b)
                    setForm({})
                  }}>
                    + Attribuer un locataire
                  </button>
                </div>
              ) : (
                <div style={{display:'flex', flexDirection:'column', gap:8}}>
                  {locsActives.map(loc => (
                    <div key={loc.id} style={{display:'flex', alignItems:'center', gap:10, flexWrap:'wrap'}}>
                      <span className="status status-green">Occupe</span>
                      {loc.profiles ? (
                        <span
                          onClick={() => navigate('/locataires')}
                          style={{fontSize:13, color:'#2D5A3D', fontWeight:500, cursor:'pointer', textDecoration:'underline'}}
                        >
                          {loc.profiles.prenom} {loc.profiles.nom}
                        </span>
                      ) : (
                        <span style={{fontSize:12, color:'#9E9890'}}>Compte locataire en attente</span>
                      )}
                      {loc.profiles?.telephone && (
                        <span style={{fontSize:12, color:'#9E9890'}}>{loc.profiles.telephone}</span>
                      )}
                      <span style={{fontSize:12, color:'#6B6560'}}>
                        {Number(loc.loyer_mensuel).toLocaleString('fr-FR')} euros/mois
                      </span>
                      {loc.date_debut && (
                        <span style={{fontSize:11, color:'#9E9890'}}>
                          depuis {new Date(loc.date_debut).toLocaleDateString('fr-FR')}
                        </span>
                      )}
                      <button className="btn btn-danger btn-xs" onClick={() => retirer(loc.id)}>
                        Retirer
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })}

      {/* Modal bien */}
      {modal !== null && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">{modal.id ? 'Modifier le bien' : 'Nouveau bien'}</span>
              <button className="modal-close" onClick={() => setModal(null)}>X</button>
            </div>
            <div className="modal-body">
              {formErr && <div className="alert alert-error">{formErr}</div>}
              <div className="grid2">
                <div className="fld"><label>Adresse *</label><input value={form.adresse||''} onChange={e=>set('adresse',e.target.value)}/></div>
                <div className="fld"><label>Ville *</label><input value={form.ville||''} onChange={e=>set('ville',e.target.value)}/></div>
              </div>
              <div className="grid2">
                <div className="fld"><label>Code postal</label><input value={form.code_postal||''} onChange={e=>set('code_postal',e.target.value)}/></div>
                <div className="fld">
                  <label>Type</label>
                  <select value={form.type_bien||''} onChange={e=>set('type_bien',e.target.value)}>
                    <option value="">Choisir</option>
                    {TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="fld"><label>Surface (m2)</label><input type="number" value={form.surface_m2||''} onChange={e=>set('surface_m2',e.target.value)}/></div>
              <button className="btn btn-primary" onClick={saveBien} disabled={saving}>
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal attribution locataire */}
      {attrib && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setAttrib(null)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">Attribuer - {attrib.adresse}</span>
              <button className="modal-close" onClick={() => setAttrib(null)}>X</button>
            </div>
            <div className="modal-body">
              {formErr && <div className="alert alert-error">{formErr}</div>}
              <div className="fld">
                <label>Locataire *</label>
                <select value={form.loc_id||''} onChange={e=>set('loc_id',e.target.value)}>
                  <option value="">Choisir un locataire</option>
                  {locataires.map(l => (
                    <option key={l.id} value={l.id}>
                      {l.prenom} {l.nom}{l.telephone ? ' - ' + l.telephone : ''}
                    </option>
                  ))}
                </select>
                {locataires.length === 0 && (
                  <div style={{fontSize:12, color:'#9E9890', marginTop:4}}>
                    Aucun compte locataire trouve. Creez d'abord un locataire dans le menu Locataires.
                  </div>
                )}
              </div>
              <div className="grid2">
                <div className="fld"><label>Loyer HC (euros) *</label><input type="number" value={form.loyer||''} onChange={e=>set('loyer',e.target.value)}/></div>
                <div className="fld"><label>Date entree *</label><input type="date" value={form.date_debut||''} onChange={e=>set('date_debut',e.target.value)}/></div>
              </div>
              <div className="grid2">
                <div className="fld"><label>Date sortie prevue</label><input type="date" value={form.date_fin||''} onChange={e=>set('date_fin',e.target.value)}/></div>
                <div className="fld">
                  <label>Type contrat</label>
                  <select value={form.type_contrat||''} onChange={e=>set('type_contrat',e.target.value)}>
                    <option value="">Choisir</option>
                    <option value="bail_vide">Bail vide</option>
                    <option value="bail_meuble">Bail meuble</option>
                    <option value="bail_commercial">Bail commercial</option>
                    <option value="courte_duree">Courte duree</option>
                    <option value="colocation">Colocation</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>
              </div>
              <button className="btn btn-primary" onClick={attribuer} disabled={saving}>
                {saving ? 'Attribution...' : 'Attribuer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
