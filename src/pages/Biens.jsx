import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const TYPES = ['Appartement','Maison','Studio','Duplex','Local commercial','Bureau','Terrain','Parking','Autre']

const CONTRATS_L = {
  bail_vide: 'Bail vide', bail_meuble: 'Bail meuble',
  bail_commercial: 'Bail commercial', courte_duree: 'Courte duree',
  colocation: 'Colocation', autre: 'Autre',
}

export default function Biens() {
  const { session, profile } = useAuth()
  const navigate  = useNavigate()
  const [biens,      setBiens]      = useState([])
  const [locataires, setLocataires] = useState([])  // profils role=locataire
  const [expanded,   setExpanded]   = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [modalBien,  setModalBien]  = useState(null)  // modal ajout/edit bien
  const [modalLoc,   setModalLoc]   = useState(null)  // modal attribution locataire (bien)
  const [modeSaisie, setModeSaisie] = useState('existant') // 'existant' | 'nouveau'
  const [form,       setForm]       = useState({})
  const [saving,     setSaving]     = useState(false)
  const [formErr,    setFormErr]    = useState('')

  const load = useCallback(async () => {
    if (!session?.user || !profile) return
    setLoading(true); setError(null)
    try {
      const isAdmin = profile.role === 'admin'
      const [bR, lR] = await Promise.all([
        isAdmin
          ? supabase.from('biens').select(`
              *, 
              locations(
                id, statut, loyer_mensuel, charges, date_debut, date_fin, type_contrat,
                locataire_id,
                profiles!locataire_id(id, nom, prenom, telephone, email),
                occupants(id, nom, prenom, lien)
              )
            `).order('created_at', { ascending: false })
          : supabase.from('biens').select(`
              *, 
              locations(
                id, statut, loyer_mensuel, charges, date_debut, date_fin, type_contrat,
                locataire_id,
                profiles!locataire_id(id, nom, prenom, telephone, email),
                occupants(id, nom, prenom, lien)
              )
            `).eq('proprietaire_id', session.user.id).order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, nom, prenom, telephone, email').eq('role', 'locataire'),
      ])
      setBiens(bR.data || [])
      setLocataires(lR.data || [])
    } catch(e) { setError(e.message) }
    finally { setLoading(false) }
  }, [session?.user?.id, profile?.role])

  useEffect(() => { load() }, [load])

  function set(k, v) { setForm(f => ({...f, [k]: v})) }

  async function saveBien() {
    if (!form.adresse || !form.ville) { setFormErr('Adresse et ville requises'); return }
    setSaving(true); setFormErr('')
    try {
      if (modalBien.id) {
        await supabase.from('biens').update({
          adresse: form.adresse, ville: form.ville,
          code_postal: form.code_postal || null,
          type_bien: form.type_bien || null,
          surface_m2: form.surface_m2 ? Number(form.surface_m2) : null,
          nb_pieces: form.nb_pieces ? Number(form.nb_pieces) : null,
          description: form.description || null,
        }).eq('id', modalBien.id)
      } else {
        await supabase.from('biens').insert({
          adresse: form.adresse, ville: form.ville,
          code_postal: form.code_postal || null,
          type_bien: form.type_bien || null,
          surface_m2: form.surface_m2 ? Number(form.surface_m2) : null,
          nb_pieces: form.nb_pieces ? Number(form.nb_pieces) : null,
          description: form.description || null,
          proprietaire_id: session.user.id,
        })
      }
      setModalBien(null); await load()
    } catch(e) { setFormErr(e.message) }
    finally { setSaving(false) }
  }

  // Attribuer un locataire EXISTANT (profil déjà créé)
  async function attribuerExistant() {
    if (!form.loc_id || !form.loyer || !form.date_debut) {
      setFormErr('Locataire, loyer et date requis'); return
    }
    setSaving(true); setFormErr('')
    try {
      const locActive = modalLoc.locations?.find(l => l.statut === 'actif')
      if (locActive) await supabase.from('locations').update({ statut:'termine', date_fin: new Date().toISOString().split('T')[0] }).eq('id', locActive.id)
      await supabase.from('locations').insert({
        bien_id: modalLoc.id,
        locataire_id: form.loc_id,
        loyer_mensuel: Number(form.loyer),
        charges: form.charges ? Number(form.charges) : 0,
        date_debut: form.date_debut,
        date_fin: form.date_fin || null,
        type_contrat: form.type_contrat || null,
        statut: 'actif',
      })
      setModalLoc(null); await load()
    } catch(e) { setFormErr(e.message) }
    finally { setSaving(false) }
  }

  // Créer un NOUVEAU locataire directement depuis Biens
  async function creerEtAttribuer() {
    const errors = []
    if (!form.n_prenom || !form.n_nom) errors.push('Nom et prenom')
    if (!form.loyer)    errors.push('Loyer')
    if (!form.date_debut) errors.push('Date entree')
    if (errors.length > 0) { setFormErr('Champs manquants : ' + errors.join(', ')); return }
    setSaving(true); setFormErr('')
    try {
      // Terminer l'ancienne location active
      const locActive = modalLoc.locations?.find(l => l.statut === 'actif')
      if (locActive) await supabase.from('locations').update({ statut:'termine', date_fin: new Date().toISOString().split('T')[0] }).eq('id', locActive.id)
      // Créer la location (sans profil lié)
      const { data: loc, error: e } = await supabase.from('locations').insert({
        bien_id: modalLoc.id,
        locataire_id: null,
        loyer_mensuel: Number(form.loyer),
        charges: form.charges ? Number(form.charges) : 0,
        date_debut: form.date_debut,
        date_fin: form.date_fin || null,
        type_contrat: form.type_contrat || null,
        statut: 'actif',
      }).select().single()
      if (e) throw e
      // Créer l'occupant principal
      await supabase.from('occupants').insert({
        location_id: loc.id,
        nom: form.n_nom, prenom: form.n_prenom,
        lien: 'titulaire',
        date_naissance: form.n_dob || null,
      })
      setModalLoc(null); await load()
    } catch(e) { setFormErr(e.message) }
    finally { setSaving(false) }
  }

  async function retirer(locationId) {
    if (!window.confirm('Terminer cette location ?')) return
    await supabase.from('locations').update({ statut:'termine', date_fin: new Date().toISOString().split('T')[0] }).eq('id', locationId)
    await load()
  }

  async function delBien(id) {
    if (!window.confirm('Supprimer ce bien et toutes ses donnees ?')) return
    try {
      // Supprimer dans l'ordre des FK
      const locsRes = await supabase.from('locations').select('id').eq('bien_id', id)
      const locIds  = (locsRes.data || []).map(l => l.id)
      if (locIds.length > 0) {
        await supabase.from('occupants').delete().in('location_id', locIds)
        await supabase.from('garants').delete().in('location_id', locIds)
      }
      await supabase.from('locations').delete().eq('bien_id', id)
      await supabase.from('plan_equipements').delete().eq('bien_id', id)
      await supabase.from('plan_pieces').delete().eq('bien_id', id)
      await supabase.from('incidents').delete().eq('bien_id', id)
      const { error: e } = await supabase.from('biens').delete().eq('id', id)
      if (e) throw e
    } catch(e) { alert('Erreur : ' + e.message) }
    await load()
  }

  // Obtenir le nom à afficher pour une location (profil ou occupant titulaire)
  function getNomLoc(loc) {
    if (loc.profiles) return `${loc.profiles.prenom} ${loc.profiles.nom}`
    const t = (loc.occupants || []).find(o => o.lien === 'titulaire')
    if (t) return `${t.prenom} ${t.nom} (sans compte)`
    return 'Locataire inconnu'
  }

  if (loading) return <Layout><div className="it-center"><div className="it-spinner"/></div></Layout>
  if (error)   return <Layout><div className="it-center"><div className="alert alert-error">{error}<br/><button className="btn btn-secondary btn-sm" style={{marginTop:8}} onClick={load}>Reessayer</button></div></div></Layout>

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Mes biens</h1>
          <p className="page-sub">
            {biens.length} bien(s) — {biens.filter(b => b.locations?.some(l => l.statut === 'actif')).length} occupe(s)
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm({}); setFormErr(''); setModalBien({}) }}>
          + Ajouter un bien
        </button>
      </div>

      {biens.length === 0 && (
        <div className="card"><div className="card-body" style={{textAlign:'center', padding:40}}>
          <div style={{fontSize:48}}>🏠</div>
          <p style={{color:'#6B6560', margin:'12px 0'}}>Aucun bien.</p>
          <button className="btn btn-primary" onClick={() => { setForm({}); setModalBien({}) }}>+ Ajouter</button>
        </div></div>
      )}

      {biens.map(b => {
        const locsActives = (b.locations || []).filter(l => l.statut === 'actif')
        const locsArch    = (b.locations || []).filter(l => l.statut !== 'actif')
        const isExp       = expanded === b.id
        return (
          <div key={b.id} className="card" style={{marginBottom:12}}>
            {/* En-tête cliquable */}
            <div className="card-header" style={{cursor:'pointer'}} onClick={() => setExpanded(isExp ? null : b.id)}>
              <div style={{flex:1}}>
                <div style={{fontWeight:600, fontSize:15, marginBottom:2}}>{b.adresse}</div>
                <div style={{display:'flex', gap:8, alignItems:'center', flexWrap:'wrap'}}>
                  <span className={`status ${locsActives.length > 0 ? 'status-green' : 'status-grey'}`}>
                    {locsActives.length > 0 ? 'Occupe' : 'Vacant'}
                  </span>
                  <span style={{fontSize:12, color:'#6B6560'}}>
                    {b.type_bien || 'Bien'} — {b.ville}{b.code_postal ? ' ' + b.code_postal : ''}
                    {b.surface_m2 ? ' — ' + b.surface_m2 + ' m2' : ''}
                    {b.nb_pieces ? ' — ' + b.nb_pieces + ' pieces' : ''}
                  </span>
                  {locsActives.length > 0 && (
                    <span style={{fontSize:12, fontWeight:500, color:'#2D5A3D'}}>
                      {locsActives.map(l => getNomLoc(l)).join(', ')}
                    </span>
                  )}
                </div>
              </div>
              <div style={{display:'flex', gap:5, flexWrap:'wrap', alignItems:'center'}}>
                <button className="btn btn-secondary btn-sm" onClick={e => { e.stopPropagation(); navigate('/biens/' + b.id + '/plan') }}>
                  Plan
                </button>
                <button className="btn btn-secondary btn-sm" onClick={e => {
                  e.stopPropagation()
                  setFormErr(''); setModeSaisie('existant'); setForm({}); setModalLoc(b)
                }}>
                  + Locataire
                </button>
                <button className="btn btn-secondary btn-sm" onClick={e => {
                  e.stopPropagation()
                  setForm({ adresse:b.adresse, ville:b.ville, code_postal:b.code_postal, type_bien:b.type_bien, surface_m2:b.surface_m2, nb_pieces:b.nb_pieces, description:b.description })
                  setFormErr(''); setModalBien(b)
                }}>
                  Modifier
                </button>
                <button className="btn btn-danger btn-sm" onClick={e => { e.stopPropagation(); delBien(b.id) }}>
                  Supprimer
                </button>
                <span style={{color:'#9E9890', fontSize:13}}>{isExp ? '▲' : '▼'}</span>
              </div>
            </div>

            {/* Détail expandable */}
            {isExp && (
              <div className="card-body" style={{borderTop:'1px solid rgba(0,0,0,.07)'}}>
                {/* Infos bien */}
                <div style={{display:'flex', gap:12, flexWrap:'wrap', marginBottom:12, fontSize:12, color:'#6B6560'}}>
                  {b.surface_m2 && <span>Surface : {b.surface_m2} m2</span>}
                  {b.nb_pieces  && <span>Pieces : {b.nb_pieces}</span>}
                  {b.code_postal && <span>CP : {b.code_postal}</span>}
                  {b.description && <span>{b.description}</span>}
                </div>

                {/* Locations actives */}
                {locsActives.length === 0 ? (
                  <div style={{display:'flex', gap:10, alignItems:'center', padding:'8px 0'}}>
                    <span style={{fontSize:13, color:'#9E9890'}}>Aucune location active.</span>
                    <button className="btn btn-primary btn-sm" onClick={() => { setFormErr(''); setModeSaisie('existant'); setForm({}); setModalLoc(b) }}>
                      + Attribuer un locataire
                    </button>
                  </div>
                ) : (
                  <div>
                    <div style={{fontSize:10, fontWeight:700, color:'#2D5A3D', textTransform:'uppercase', marginBottom:8}}>Location active</div>
                    {locsActives.map(loc => {
                      const titulaire = (loc.occupants||[]).find(o => o.lien === 'titulaire')
                      const autres    = (loc.occupants||[]).filter(o => o.lien !== 'titulaire')
                      return (
                        <div key={loc.id} style={{background:'#E8F2EB', borderRadius:10, padding:'12px 14px', marginBottom:8}}>
                          <div style={{display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:8}}>
                            <div>
                              <div style={{fontWeight:600, fontSize:14}}>
                                {loc.profiles
                                  ? `${loc.profiles.prenom} ${loc.profiles.nom}`
                                  : titulaire
                                  ? `${titulaire.prenom} ${titulaire.nom}`
                                  : 'Nom inconnu'}
                              </div>
                              {loc.profiles?.telephone && <div style={{fontSize:12, color:'#6B6560'}}>{loc.profiles.telephone}</div>}
                              {loc.profiles?.email     && <div style={{fontSize:12, color:'#6B6560'}}>{loc.profiles.email}</div>}
                              {!loc.profiles && <div style={{fontSize:11, color:'#C8813A'}}>Pas de compte ImmoTrack — locataire manuel</div>}
                            </div>
                            <button className="btn btn-danger btn-sm" onClick={() => retirer(loc.id)}>Retirer</button>
                          </div>
                          <div style={{display:'flex', gap:16, marginTop:10, flexWrap:'wrap', fontSize:12}}>
                            <span><strong>Loyer :</strong> {Number(loc.loyer_mensuel||0).toLocaleString('fr-FR')} euros HC{loc.charges > 0 ? ' + ' + Number(loc.charges).toLocaleString('fr-FR') + ' ch.' : ''}</span>
                            {loc.date_debut && <span><strong>Entree :</strong> {new Date(loc.date_debut).toLocaleDateString('fr-FR')}</span>}
                            {loc.date_fin   && <span><strong>Fin prevue :</strong> {new Date(loc.date_fin).toLocaleDateString('fr-FR')}</span>}
                            {loc.type_contrat && <span><strong>Contrat :</strong> {CONTRATS_L[loc.type_contrat] || loc.type_contrat}</span>}
                          </div>
                          {autres.length > 0 && (
                            <div style={{marginTop:8, fontSize:12, color:'#6B6560'}}>
                              Autres occupants : {autres.map(o => `${o.prenom} ${o.nom} (${o.lien})`).join(', ')}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Historique */}
                {locsArch.length > 0 && (
                  <div style={{marginTop:12}}>
                    <div style={{fontSize:10, fontWeight:700, color:'#9E9890', textTransform:'uppercase', marginBottom:6}}>Historique ({locsArch.length})</div>
                    {locsArch.slice(0,3).map(loc => {
                      const t = (loc.occupants||[]).find(o => o.lien === 'titulaire')
                      return (
                        <div key={loc.id} style={{fontSize:12, color:'#9E9890', padding:'4px 0', borderBottom:'1px solid rgba(0,0,0,.05)'}}>
                          {loc.profiles ? `${loc.profiles.prenom} ${loc.profiles.nom}` : t ? `${t.prenom} ${t.nom}` : 'Inconnu'}
                          {' — '}{Number(loc.loyer_mensuel||0).toLocaleString('fr-FR')} euros
                          {loc.date_debut ? ' — entree ' + new Date(loc.date_debut).toLocaleDateString('fr-FR') : ''}
                          {loc.date_fin   ? ' — sortie ' + new Date(loc.date_fin).toLocaleDateString('fr-FR') : ''}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Modal bien */}
      {modalBien !== null && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setModalBien(null)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">{modalBien.id ? 'Modifier le bien' : 'Nouveau bien'}</span>
              <button className="modal-close" onClick={() => setModalBien(null)}>X</button>
            </div>
            <div className="modal-body">
              {formErr && <div className="alert alert-error">{formErr}</div>}
              <div className="grid2">
                <div className="fld"><label>Adresse *</label><input value={form.adresse||''} onChange={e=>set('adresse',e.target.value)}/></div>
                <div className="fld"><label>Ville *</label><input value={form.ville||''} onChange={e=>set('ville',e.target.value)}/></div>
              </div>
              <div className="grid2">
                <div className="fld"><label>Code postal</label><input value={form.code_postal||''} onChange={e=>set('code_postal',e.target.value)}/></div>
                <div className="fld"><label>Type</label>
                  <select value={form.type_bien||''} onChange={e=>set('type_bien',e.target.value)}>
                    <option value="">Choisir</option>
                    {TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid2">
                <div className="fld"><label>Surface (m2)</label><input type="number" value={form.surface_m2||''} onChange={e=>set('surface_m2',e.target.value)}/></div>
                <div className="fld"><label>Nb pieces</label><input type="number" value={form.nb_pieces||''} onChange={e=>set('nb_pieces',e.target.value)}/></div>
              </div>
              <div className="fld"><label>Description / Notes</label><textarea value={form.description||''} onChange={e=>set('description',e.target.value)} style={{minHeight:60}}/></div>
              <button className="btn btn-primary" onClick={saveBien} disabled={saving}>{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal locataire (attribuer ou créer) */}
      {modalLoc && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setModalLoc(null)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">Locataire pour : {modalLoc.adresse}</span>
              <button className="modal-close" onClick={() => setModalLoc(null)}>X</button>
            </div>
            <div className="modal-body">
              {formErr && <div className="alert alert-error">{formErr}</div>}

              {/* Onglets existant / nouveau */}
              <div style={{display:'flex', borderBottom:'1px solid rgba(0,0,0,.08)', marginBottom:14}}>
                {[['existant', 'Locataire existant'], ['nouveau', 'Nouveau locataire']].map(([v,l]) => (
                  <button key={v} onClick={() => { setModeSaisie(v); setFormErr('') }}
                    style={{padding:'7px 14px', border:'none', cursor:'pointer', background:'transparent', fontFamily:'inherit', fontSize:12, fontWeight:500,
                      color: modeSaisie===v?'#2D5A3D':'#6B6560',
                      borderBottom: modeSaisie===v?'2px solid #2D5A3D':'2px solid transparent'}}>
                    {l}
                  </button>
                ))}
              </div>

              {modeSaisie === 'existant' && (
                <>
                  <div className="fld">
                    <label>Choisir un locataire *</label>
                    <select value={form.loc_id||''} onChange={e=>set('loc_id',e.target.value)}>
                      <option value="">— Choisir —</option>
                      {locataires.map(l => (
                        <option key={l.id} value={l.id}>
                          {l.prenom} {l.nom}{l.telephone ? ' - ' + l.telephone : ''}{l.email ? ' - ' + l.email : ''}
                        </option>
                      ))}
                    </select>
                    {locataires.length === 0 && (
                      <div style={{fontSize:12, color:'#C8813A', marginTop:6, padding:'8px 10px', background:'#FDF3E7', borderRadius:6}}>
                        Aucun compte locataire disponible. Utilisez l'onglet Nouveau locataire pour en creer un sans compte, ou creez un compte depuis le menu Locataires.
                      </div>
                    )}
                  </div>
                  <div className="grid2">
                    <div className="fld"><label>Loyer HC (euros) *</label><input type="number" value={form.loyer||''} onChange={e=>set('loyer',e.target.value)}/></div>
                    <div className="fld"><label>Charges (euros)</label><input type="number" value={form.charges||''} onChange={e=>set('charges',e.target.value)}/></div>
                  </div>
                  <div className="grid2">
                    <div className="fld"><label>Date entree *</label><input type="date" value={form.date_debut||''} onChange={e=>set('date_debut',e.target.value)}/></div>
                    <div className="fld"><label>Date sortie prevue</label><input type="date" value={form.date_fin||''} onChange={e=>set('date_fin',e.target.value)}/></div>
                  </div>
                  <div className="fld"><label>Type contrat</label>
                    <select value={form.type_contrat||''} onChange={e=>set('type_contrat',e.target.value)}>
                      <option value="">Choisir</option>
                      {Object.entries(CONTRATS_L).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <button className="btn btn-primary" onClick={attribuerExistant} disabled={saving || !form.loc_id}>
                    {saving ? 'Attribution...' : 'Attribuer ce locataire'}
                  </button>
                </>
              )}

              {modeSaisie === 'nouveau' && (
                <>
                  <div className="alert alert-info" style={{fontSize:12, marginBottom:10}}>
                    Cree un locataire sans compte ImmoTrack. Identifie par son nom dans vos biens et locataires.
                  </div>
                  <div className="grid2">
                    <div className="fld"><label>Prenom *</label><input value={form.n_prenom||''} onChange={e=>set('n_prenom',e.target.value)}/></div>
                    <div className="fld"><label>Nom *</label><input value={form.n_nom||''} onChange={e=>set('n_nom',e.target.value)}/></div>
                  </div>
                  <div className="grid2">
                    <div className="fld"><label>Telephone</label><input value={form.n_tel||''} onChange={e=>set('n_tel',e.target.value)}/></div>
                    <div className="fld"><label>Date naissance</label><input type="date" value={form.n_dob||''} onChange={e=>set('n_dob',e.target.value)}/></div>
                  </div>
                  <div className="grid2">
                    <div className="fld"><label>Loyer HC (euros) *</label><input type="number" value={form.loyer||''} onChange={e=>set('loyer',e.target.value)}/></div>
                    <div className="fld"><label>Charges (euros)</label><input type="number" value={form.charges||''} onChange={e=>set('charges',e.target.value)}/></div>
                  </div>
                  <div className="grid2">
                    <div className="fld"><label>Date entree *</label><input type="date" value={form.date_debut||''} onChange={e=>set('date_debut',e.target.value)}/></div>
                    <div className="fld"><label>Date sortie prevue</label><input type="date" value={form.date_fin||''} onChange={e=>set('date_fin',e.target.value)}/></div>
                  </div>
                  <div className="fld"><label>Type contrat</label>
                    <select value={form.type_contrat||''} onChange={e=>set('type_contrat',e.target.value)}>
                      <option value="">Choisir</option>
                      {Object.entries(CONTRATS_L).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <button className="btn btn-primary" onClick={creerEtAttribuer} disabled={saving}>
                    {saving ? 'Creation...' : 'Creer et attribuer'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
