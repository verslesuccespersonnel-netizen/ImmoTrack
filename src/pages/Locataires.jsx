import React, { useState, useEffect } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const CONTRATS = [
  {v:'bail_vide',l:'Bail vide'},{v:'bail_meuble',l:'Bail meublé'},
  {v:'bail_commercial',l:'Bail commercial'},{v:'courte_duree',l:'Courte durée / Airbnb'},
  {v:'colocation',l:'Colocation'},{v:'autre',l:'Autre'},
]

export default function Locataires() {
  const { session } = useAuth()
  const [locs,    setLocs]    = useState([])
  const [biens,   setBiens]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [showArchives, setShowArchives] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [modal,   setModal]   = useState(null)
  const [form,    setForm]    = useState({})
  const [saving,  setSaving]  = useState(false)
  const [formErr, setFormErr] = useState('')

  useEffect(() => { if (session?.user) load() }, [session?.user?.id])

  async function load() {
    setLoading(true); setError(null)
    try {
      const [lr, br] = await Promise.all([
        supabase.from('locations').select(`
          *,
          biens!locations_bien_id_fkey(id,adresse,ville),
          profiles!locataire_id(id,nom,prenom,telephone,email),
          garants(*),
          occupants(*)
        `).order('created_at', {ascending:false}),
        supabase.from('biens').select('id,adresse,ville,surface_m2,type_bien').eq('proprietaire_id', session.user.id),
      ])
      const myIds = new Set((br.data||[]).map(b => b.id))
      setLocs((lr.data||[]).filter(l => myIds.has(l.bien_id)))
      setBiens(br.data||[])
    } catch(e) { setError(e.message) }
    finally { setLoading(false) }
  }

  function set(k, v) { setForm(f => ({...f, [k]: v})) }

  // Auto-remplir surface depuis le bien sélectionné
  useEffect(() => {
    if (!form.bien_id || !biens.length) return
    const bien = biens.find(b => b.id === form.bien_id)
    if (bien && bien.surface_m2 && !form.surface_m2) {
      setForm(f => ({...f, surface_m2: bien.surface_m2}))
    }
  }, [form.bien_id])

  async function createLocataire() {
    // Validation claire sans apostrophes dans les strings
    const errors = []
    if (!form.nom || !form.prenom) errors.push("Nom et prenom")
    if (!form.bien_id) errors.push("Bien a louer")
    if (!form.loyer) errors.push("Montant du loyer")
    if (!form.date_debut) errors.push("Date d'entree")
    if (errors.length > 0) {
      setFormErr("Champs obligatoires manquants : " + errors.join(", "))
      return
    }
    setSaving(true); setFormErr('')
    try {
      const { data: loc, error: e } = await supabase.from('locations').insert({
        bien_id: form.bien_id,
        locataire_id: form.user_id || null,
        loyer_mensuel: Number(form.loyer),
        charges: form.charges ? Number(form.charges) : 0,
        depot_garantie: form.depot_garantie ? Number(form.depot_garantie) : null,
        date_debut: form.date_debut,
        date_fin: form.date_fin || null,
        type_contrat: form.type_contrat || 'bail_vide',
        statut: 'actif',
      }).select().single()
      if (e) throw e

      await supabase.from('occupants').insert({
        location_id: loc.id,
        nom: form.nom,
        prenom: form.prenom,
        lien: 'titulaire',
        date_naissance: form.dob || null,
      })

      if (!form.user_id && form.email) {
        await supabase.from('invitations').insert({
          email: form.email.toLowerCase().trim(),
          role: 'locataire',
          nom: form.nom,
          prenom: form.prenom,
          telephone: form.telephone || null,
          bien_id: form.bien_id,
          loyer: Number(form.loyer),
          date_debut: form.date_debut,
          type_contrat: form.type_contrat || null,
          cree_par: session.user.id,
        }).catch(() => {})
      }

      setModal(null)
      load()
    } catch(e) { setFormErr(e.message) }
    finally { setSaving(false) }
  }

  async function addGarant() {
    if (!form.g_nom || !form.g_prenom) { setFormErr('Nom et prenom requis'); return }
    setSaving(true)
    try {
      await supabase.from('garants').insert({
        location_id: modal.locationId,
        nom: form.g_nom,
        prenom: form.g_prenom,
        telephone: form.g_tel || null,
        email: form.g_email || null,
        lien: form.g_lien || 'autre',
        type_caution: form.g_type || 'physique',
        montant: form.g_montant ? Number(form.g_montant) : null,
      })
      setModal(null); load()
    } catch(e) { setFormErr(e.message) }
    finally { setSaving(false) }
  }

  async function addOccupant() {
    if (!form.o_nom || !form.o_prenom) { setFormErr('Nom et prenom requis'); return }
    await supabase.from('occupants').insert({
      location_id: modal.locationId,
      nom: form.o_nom,
      prenom: form.o_prenom,
      lien: form.o_lien || 'autre',
      date_naissance: form.o_dob || null,
    })
    setModal(null); load()
  }

  async function archiver(id) {
    if (!window.confirm('Archiver cette location ?')) return
    await supabase.from('locations').update({
      statut: 'termine',
      date_fin: new Date().toISOString().split('T')[0],
    }).eq('id', id)
    load()
  }

  async function supprimer(id) {
    if (!window.confirm('Supprimer definitvement cette location ?')) return
    await supabase.from('locations').delete().eq('id', id)
    load()
  }

  async function delGarant(id)   { await supabase.from('garants').delete().eq('id', id); load() }
  async function delOccupant(id) { await supabase.from('occupants').delete().eq('id', id); load() }

  const actifs   = locs.filter(l => l.statut === 'actif')
  const archives = locs.filter(l => l.statut !== 'actif')

  if (loading) return <Layout><div className="it-center"><div className="it-spinner"/></div></Layout>
  if (error)   return (
    <Layout>
      <div className="it-center">
        <div className="alert alert-error" style={{maxWidth:320}}>
          {error}
          <br/>
          <button className="btn btn-secondary btn-sm" style={{marginTop:8}} onClick={load}>Reessayer</button>
        </div>
      </div>
    </Layout>
  )

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Locataires</h1>
          <p className="page-sub">
            {actifs.length} actif(s)
            {archives.length > 0 ? ` · ${archives.length} archive(s)` : ''}
          </p>
        </div>
        <div style={{display:'flex', gap:8}}>
          {archives.length > 0 && (
            <button className="btn btn-secondary" onClick={() => setShowArchives(s => !s)}>
              {showArchives ? 'Masquer archives' : `Archives (${archives.length})`}
            </button>
          )}
          <button className="btn btn-primary" onClick={() => { setForm({}); setFormErr(''); setModal({type:'create'}) }}>
            + Ajouter
          </button>
        </div>
      </div>

      {actifs.length === 0 && (
        <div className="card">
          <div className="card-body" style={{textAlign:'center', padding:40, color:'#9E9890'}}>
            Aucun locataire actif.
          </div>
        </div>
      )}

      {actifs.map(loc => (
        <LocCard key={loc.id} loc={loc}
          expanded={expanded} setExpanded={setExpanded}
          setModal={setModal} setForm={setForm} setFormErr={setFormErr}
          archiver={archiver} supprimer={supprimer}
          delGarant={delGarant} delOccupant={delOccupant}
        />
      ))}

      {showArchives && archives.length > 0 && (
        <>
          <div style={{fontSize:12, fontWeight:600, color:'#9E9890', textTransform:'uppercase', margin:'20px 0 10px', display:'flex', alignItems:'center', gap:8}}>
            <span>Archives</span>
            <div style={{flex:1, height:1, background:'rgba(0,0,0,.08)'}}/>
          </div>
          {archives.map(loc => (
            <LocCard key={loc.id} loc={loc} archived
              expanded={expanded} setExpanded={setExpanded}
              setModal={setModal} setForm={setForm} setFormErr={setFormErr}
              archiver={archiver} supprimer={supprimer}
              delGarant={delGarant} delOccupant={delOccupant}
            />
          ))}
        </>
      )}

      {/* ── MODAL ── */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setModal(null)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <span className="modal-title">
                {modal.type === 'create' ? 'Nouveau locataire'
                  : modal.type === 'garant' ? 'Ajouter un garant'
                  : 'Ajouter un occupant'}
              </span>
              <button className="modal-close" onClick={() => setModal(null)}>X</button>
            </div>
            <div className="modal-body">
              {formErr && <div className="alert alert-error">{formErr}</div>}

              {modal.type === 'create' && (
                <>
                  <div className="grid2">
                    <div className="fld"><label>Prenom *</label><input value={form.prenom||''} onChange={e=>set('prenom',e.target.value)}/></div>
                    <div className="fld"><label>Nom *</label><input value={form.nom||''} onChange={e=>set('nom',e.target.value)}/></div>
                  </div>
                  <div className="grid2">
                    <div className="fld"><label>Email</label><input type="email" value={form.email||''} onChange={e=>set('email',e.target.value)}/></div>
                    <div className="fld"><label>Telephone</label><input value={form.telephone||''} onChange={e=>set('telephone',e.target.value)}/></div>
                  </div>
                  <div className="fld"><label>Date de naissance</label><input type="date" value={form.dob||''} onChange={e=>set('dob',e.target.value)}/></div>
                  <div className="fld">
                    <label>UUID du compte (si deja cree)</label>
                    <input value={form.user_id||''} onChange={e=>set('user_id',e.target.value)} placeholder="Laisser vide sinon"/>
                  </div>
                  <div className="fld">
                    <label>Bien *</label>
                    <select value={form.bien_id||''} onChange={e=>set('bien_id',e.target.value)}>
                      <option value="">Choisir un bien</option>
                      {biens.map(b => <option key={b.id} value={b.id}>{b.adresse}, {b.ville}</option>)}
                    </select>
                  </div>
                  <div className="fld">
                    <label>Type de contrat</label>
                    <select value={form.type_contrat||''} onChange={e=>set('type_contrat',e.target.value)}>
                      <option value="">Choisir</option>
                      {CONTRATS.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
                    </select>
                  </div>
                  <div className="grid2">
                    <div className="fld"><label>Loyer HC (euros) *</label><input type="number" value={form.loyer||''} onChange={e=>set('loyer',e.target.value)}/></div>
                    <div className="fld"><label>Charges (euros/mois)</label><input type="number" value={form.charges||''} onChange={e=>set('charges',e.target.value)}/></div>
                  </div>
                  <div className="fld"><label>Depot de garantie (euros)</label><input type="number" value={form.depot_garantie||''} onChange={e=>set('depot_garantie',e.target.value)}/></div>
                  <div className="grid2">
                    <div className="fld"><label>Date d'entree *</label><input type="date" value={form.date_debut||''} onChange={e=>set('date_debut',e.target.value)}/></div>
                    <div className="fld"><label>Date de sortie prevue</label><input type="date" value={form.date_fin||''} onChange={e=>set('date_fin',e.target.value)}/></div>
                  </div>
                  <div className="grid2">
                    <div className="fld"><label>Surface (m2)</label><input type="number" value={form.surface_m2||''} onChange={e=>set('surface_m2',e.target.value)}/></div>
                    <div className="fld"><label>Nb pieces</label><input type="number" value={form.nb_pieces||''} onChange={e=>set('nb_pieces',e.target.value)}/></div>
                  </div>
                  <div style={{display:'flex', gap:16, flexWrap:'wrap', padding:'6px 0'}}>
                    {[['meuble','Meuble'],['ascenseur','Ascenseur'],['parking','Parking'],['cave','Cave']].map(([k,l]) => (
                      <label key={k} style={{display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:13}}>
                        <input type="checkbox" checked={form[k]||false} onChange={e=>set(k,e.target.checked)}/>
                        {l}
                      </label>
                    ))}
                  </div>
                  <div className="fld"><label>Notes</label><textarea value={form.notes||''} onChange={e=>set('notes',e.target.value)}/></div>
                  <button className="btn btn-primary" onClick={createLocataire} disabled={saving}>
                    {saving ? 'Creation...' : 'Creer le locataire'}
                  </button>
                </>
              )}

              {modal.type === 'garant' && (
                <>
                  <div className="grid2">
                    <div className="fld"><label>Prenom *</label><input value={form.g_prenom||''} onChange={e=>set('g_prenom',e.target.value)}/></div>
                    <div className="fld"><label>Nom *</label><input value={form.g_nom||''} onChange={e=>set('g_nom',e.target.value)}/></div>
                  </div>
                  <div className="grid2">
                    <div className="fld"><label>Telephone</label><input value={form.g_tel||''} onChange={e=>set('g_tel',e.target.value)}/></div>
                    <div className="fld"><label>Email</label><input type="email" value={form.g_email||''} onChange={e=>set('g_email',e.target.value)}/></div>
                  </div>
                  <div className="fld">
                    <label>Lien avec le locataire</label>
                    <select value={form.g_lien||'autre'} onChange={e=>set('g_lien',e.target.value)}>
                      {['parent','conjoint','ami','employeur','organisme','autre'].map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div className="fld">
                    <label>Type de caution</label>
                    <select value={form.g_type||'physique'} onChange={e=>set('g_type',e.target.value)}>
                      {[['physique','Personne physique'],['morale','Personne morale'],['visale','Visale'],['bancaire','Caution bancaire']].map(([v,l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </div>
                  <div className="fld"><label>Montant garanti (euros)</label><input type="number" value={form.g_montant||''} onChange={e=>set('g_montant',e.target.value)}/></div>
                  <button className="btn btn-primary" onClick={addGarant} disabled={saving}>
                    {saving ? '...' : 'Ajouter'}
                  </button>
                </>
              )}

              {modal.type === 'occupant' && (
                <>
                  <div className="grid2">
                    <div className="fld"><label>Prenom *</label><input value={form.o_prenom||''} onChange={e=>set('o_prenom',e.target.value)}/></div>
                    <div className="fld"><label>Nom *</label><input value={form.o_nom||''} onChange={e=>set('o_nom',e.target.value)}/></div>
                  </div>
                  <div className="grid2">
                    <div className="fld"><label>Date de naissance</label><input type="date" value={form.o_dob||''} onChange={e=>set('o_dob',e.target.value)}/></div>
                    <div className="fld">
                      <label>Lien</label>
                      <select value={form.o_lien||'autre'} onChange={e=>set('o_lien',e.target.value)}>
                        {['titulaire','conjoint','enfant','colocataire','autre'].map(l => <option key={l}>{l}</option>)}
                      </select>
                    </div>
                  </div>
                  <button className="btn btn-primary" onClick={addOccupant}>Ajouter</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

function LocCard({ loc, archived, expanded, setExpanded, setModal, setForm, setFormErr, archiver, supprimer, delGarant, delOccupant }) {
  const isExp = expanded === loc.id
  const p     = loc.profiles
  const t     = loc.occupants?.find(o => o.lien === 'titulaire')
  const nom   = p ? `${p.prenom} ${p.nom}` : t ? `${t.prenom} ${t.nom}` : 'Sans compte'
  const avertissement = !p && t ? ' (compte non cree)' : !p && !t ? ' (aucun profil)' : ''

  return (
    <div className="card" style={{marginBottom:10, opacity: archived ? 0.75 : 1}}>
      <div className="card-header" style={{cursor:'pointer'}} onClick={() => setExpanded(isExp ? null : loc.id)}>
        <div style={{display:'flex', alignItems:'center', gap:10}}>
          <div style={{width:36, height:36, borderRadius:'50%', background: archived?'#F7F5F0':'#EBF2FC', color: archived?'#9E9890':'#2B5EA7', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, flexShrink:0}}>
            {nom[0]}{nom.split(' ')?.[1]?.[0]||''}
          </div>
          <div>
            <div style={{fontWeight:600, fontSize:14}}>
              {nom}
              {avertissement && <span style={{fontSize:11, color:'#B83232', marginLeft:6}}>{avertissement}</span>}
            </div>
            <div style={{fontSize:12, color:'#6B6560'}}>
              {loc.biens?.adresse}, {loc.biens?.ville}
              {loc.loyer_mensuel ? ` · ${Number(loc.loyer_mensuel).toLocaleString('fr-FR')} /mois` : ''}
              {loc.date_debut ? ` · entree ${new Date(loc.date_debut).toLocaleDateString('fr-FR')}` : ''}
            </div>
          </div>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:6}}>
          <span className={`status ${loc.statut==='actif'?'status-green':'status-grey'}`}>{loc.statut}</span>
          {loc.type_contrat && (
            <span className="status status-blue" style={{fontSize:10}}>
              {CONTRATS.find(c=>c.v===loc.type_contrat)?.l || loc.type_contrat}
            </span>
          )}
          <span style={{color:'#9E9890'}}>{isExp ? '▲' : '▼'}</span>
        </div>
      </div>

      {isExp && (
        <div className="card-body">
          {p && (
            <div style={{fontSize:13, marginBottom:10, display:'flex', gap:14, flexWrap:'wrap', background:'#F7F5F0', padding:'8px 12px', borderRadius:8}}>
              {p.telephone && <span>Tel : {p.telephone}</span>}
              {p.email && <span>Email : {p.email}</span>}
            </div>
          )}

          {loc.depot_garantie > 0 && (
            <div style={{marginBottom:10, background:'#FDF3E7', borderRadius:8, padding:'8px 12px', fontSize:13}}>
              <strong>Depot de garantie :</strong> {Number(loc.depot_garantie).toLocaleString('fr-FR')} euros
            </div>
          )}

          {(loc.occupants||[]).length > 0 && (
            <div style={{marginBottom:10}}>
              <div style={{fontSize:10, fontWeight:700, color:'#9E9890', textTransform:'uppercase', marginBottom:5}}>Occupants</div>
              {loc.occupants.map(o => (
                <div key={o.id} style={{display:'flex', justifyContent:'space-between', padding:'3px 0', borderBottom:'1px solid rgba(0,0,0,.04)', fontSize:13}}>
                  <span>
                    {o.prenom} {o.nom}
                    <span style={{color:'#9E9890', fontSize:11, marginLeft:6}}>
                      ({o.lien}){o.date_naissance ? ` · ${new Date().getFullYear()-new Date(o.date_naissance).getFullYear()} ans` : ''}
                    </span>
                  </span>
                  <button onClick={() => delOccupant(o.id)} style={{background:'none', border:'none', cursor:'pointer', color:'#B83232', fontSize:13}}>X</button>
                </div>
              ))}
            </div>
          )}

          {(loc.garants||[]).length > 0 && (
            <div style={{marginBottom:10}}>
              <div style={{fontSize:10, fontWeight:700, color:'#9E9890', textTransform:'uppercase', marginBottom:5}}>Garants ({loc.garants.length})</div>
              {loc.garants.map(g => (
                <div key={g.id} style={{display:'flex', justifyContent:'space-between', padding:'3px 0', borderBottom:'1px solid rgba(0,0,0,.04)', fontSize:13}}>
                  <div>
                    <span style={{fontWeight:500}}>{g.prenom} {g.nom}</span>
                    <span style={{color:'#9E9890', fontSize:11, marginLeft:6}}>
                      {g.lien} · {g.type_caution}
                      {g.montant ? ` · ${Number(g.montant).toLocaleString('fr-FR')} euros` : ''}
                      {g.telephone ? ` · ${g.telephone}` : ''}
                    </span>
                  </div>
                  <button onClick={() => delGarant(g.id)} style={{background:'none', border:'none', cursor:'pointer', color:'#B83232', fontSize:13}}>X</button>
                </div>
              ))}
            </div>
          )}

          <div style={{display:'flex', gap:8, flexWrap:'wrap', paddingTop:8, borderTop:'1px solid rgba(0,0,0,.07)'}}>
            {!archived && (
              <>
                <button className="btn btn-secondary btn-sm" onClick={() => { setFormErr(''); setForm({}); setModal({type:'occupant', locationId:loc.id}) }}>+ Occupant</button>
                <button className="btn btn-secondary btn-sm" onClick={() => { setFormErr(''); setForm({}); setModal({type:'garant', locationId:loc.id}) }}>+ Garant</button>
                <button className="btn btn-danger btn-sm" onClick={() => archiver(loc.id)}>Archiver</button>
              </>
            )}
            <button className="btn btn-danger btn-sm" onClick={() => supprimer(loc.id)}>Supprimer</button>
          </div>
        </div>
      )}
    </div>
  )
}
