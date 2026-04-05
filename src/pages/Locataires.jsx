import React, { useEffect, useState, useCallback } from 'react'
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
  const [locs, setLocs]         = useState([])
  const [biens, setBiens]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [showArchives, setShowArchives] = useState(false)
  const [modal, setModal]       = useState(null)
  const [form, setForm]         = useState({})
  const [saving, setSaving]     = useState(false)
  const [formError, setFormError] = useState('')
  const [expanded, setExpanded] = useState(null)

  const load = useCallback(() => {
    if (!session?.user) return
    setLoading(true)
    setError(null)

    const ctrl = new AbortController()
    const timeout = setTimeout(() => ctrl.abort(), 8000)

    Promise.all([
      supabase.from('locations')
        .select(`
          *,
          biens!locations_bien_id_fkey(id, adresse, ville),
          profiles!locataire_id(id, nom, prenom, telephone, telephone2, email),
          garants(*),
          occupants(*)
        `)
        .order('created_at', { ascending: false })
        .abortSignal(ctrl.signal),
      supabase.from('biens')
        .select('id, adresse, ville')
        .eq('proprietaire_id', session.user.id)
        .abortSignal(ctrl.signal),
    ])
    .then(([locsRes, biensRes]) => {
      clearTimeout(timeout)
      if (ctrl.signal.aborted) return
      const myBienIds = new Set((biensRes.data||[]).map(b => b.id))
      setLocs((locsRes.data||[]).filter(l => myBienIds.has(l.bien_id)))
      setBiens(biensRes.data||[])
      setLoading(false)
    })
    .catch(e => {
      clearTimeout(timeout)
      if (ctrl.signal.aborted) { window.location.reload(); return }
      setError(e.message)
      setLoading(false)
    })

    return () => { ctrl.abort(); clearTimeout(timeout) }
  }, [session?.user?.id])

  useEffect(() => {
    const cleanup = load()
    return cleanup
  }, [load])

  useEffect(() => {
    function onVisible() { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [load])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function createLocataire() {
    if (!form.nom || !form.prenom || !form.bien_id || !form.loyer || !form.date_debut) {
      setFormError('Nom, prénom, bien, loyer et date d\'entrée sont obligatoires.')
      return
    }
    setSaving(true); setFormError('')
    try {
      const { data: loc, error: locErr } = await supabase.from('locations').insert({
        bien_id: form.bien_id,
        locataire_id: form.user_id || null,
        loyer_mensuel: Number(form.loyer),
        date_debut: form.date_debut,
        date_fin: form.date_fin || null,
        type_contrat: form.type_contrat || null,
        statut: 'actif',
      }).select().single()
      if (locErr) throw locErr

      await supabase.from('occupants').insert({
        location_id: loc.id, nom: form.nom, prenom: form.prenom,
        lien: 'titulaire', date_naissance: form.dob || null,
      })

      if (!form.user_id && form.email) {
        try {
          await supabase.from('invitations').insert({
            email: form.email.toLowerCase().trim(), role: 'locataire',
            nom: form.nom, prenom: form.prenom, telephone: form.telephone || null,
            bien_id: form.bien_id, loyer: Number(form.loyer),
            date_debut: form.date_debut, type_contrat: form.type_contrat || null,
            cree_par: session.user.id,
          })
        } catch(_) { /* invitation optionnelle */ }
      }

      setModal(null)
      load()
    } catch(e) { setFormError(e.message) }
    finally { setSaving(false) }
  }

  async function addGarant() {
    if (!form.g_nom || !form.g_prenom) { setFormError('Nom et prénom requis'); return }
    setSaving(true)
    try {
      await supabase.from('garants').insert({
        location_id: modal.locationId,
        nom: form.g_nom, prenom: form.g_prenom,
        telephone: form.g_tel || null, email: form.g_email || null,
        lien: form.g_lien || 'autre', type_caution: form.g_type || 'physique',
        montant: form.g_montant ? Number(form.g_montant) : null,
      })
      setModal(null); load()
    } catch(e) { setFormError(e.message) }
    finally { setSaving(false) }
  }

  async function addOccupant() {
    if (!form.o_nom || !form.o_prenom) { setFormError('Nom et prénom requis'); return }
    setSaving(true)
    try {
      await supabase.from('occupants').insert({
        location_id: modal.locationId,
        nom: form.o_nom, prenom: form.o_prenom,
        lien: form.o_lien || 'autre', date_naissance: form.o_dob || null,
      })
      setModal(null); load()
    } catch(e) { setFormError(e.message) }
    finally { setSaving(false) }
  }

  async function archiver(locationId) {
    if (!window.confirm('Archiver cette location ? Elle restera visible dans les archives.')) return
    await supabase.from('locations').update({
      statut: 'termine', date_fin: form.date_sortie || new Date().toISOString().split('T')[0]
    }).eq('id', locationId)
    load()
  }

  async function supprimer(locationId) {
    if (!window.confirm('Supprimer définitivement cette location et toutes ses données (garants, occupants) ?')) return
    await supabase.from('locations').delete().eq('id', locationId)
    load()
  }

  async function delGarant(id) { await supabase.from('garants').delete().eq('id',id); load() }
  async function delOccupant(id) { await supabase.from('occupants').delete().eq('id',id); load() }

  // Séparer actifs et archivés
  const locsActives   = locs.filter(l => l.statut === 'actif')
  const locsArchivees = locs.filter(l => l.statut !== 'actif')

  if (loading) return <Layout><div className="it-center"><div className="it-spinner"/></div></Layout>
  if (error)   return (
    <Layout>
      <div className="it-center" style={{ flexDirection:'column', gap:12 }}>
        <div className="alert alert-error">{error}</div>
        <button className="btn btn-secondary" onClick={load}>↺ Réessayer</button>
      </div>
    </Layout>
  )

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Locataires</h1>
          <p className="page-sub">
            {locsActives.length} actif(s)
            {locsArchivees.length > 0 && ` · ${locsArchivees.length} archivé(s)`}
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {locsArchivees.length > 0 && (
            <button className="btn btn-secondary" onClick={() => setShowArchives(s => !s)}>
              {showArchives ? '🙈 Masquer archives' : `📦 Archives (${locsArchivees.length})`}
            </button>
          )}
          <button className="btn btn-primary" onClick={() => { setForm({}); setFormError(''); setModal({ type:'create' }) }}>
            + Ajouter
          </button>
        </div>
      </div>

      {locsActives.length === 0 && (
        <div className="card">
          <div className="card-body" style={{ textAlign:'center', padding:40, color:'#9E9890' }}>
            Aucun locataire actif. Ajoutez votre premier locataire.
          </div>
        </div>
      )}

      {/* Locataires actifs */}
      {locsActives.map(loc => <LocCard key={loc.id} loc={loc} expanded={expanded} setExpanded={setExpanded} setModal={setModal} setForm={setForm} setFormError={setFormError} archiver={archiver} supprimer={supprimer} delGarant={delGarant} delOccupant={delOccupant} />)}

      {/* Archives */}
      {showArchives && locsArchivees.length > 0 && (
        <>
          <div style={{ fontSize:12, fontWeight:600, color:'#9E9890', textTransform:'uppercase', letterSpacing:'.05em', margin:'20px 0 10px', display:'flex', alignItems:'center', gap:8 }}>
            <span>📦 Archives</span>
            <div style={{ flex:1, height:1, background:'rgba(0,0,0,.08)' }}/>
          </div>
          {locsArchivees.map(loc => <LocCard key={loc.id} loc={loc} archived expanded={expanded} setExpanded={setExpanded} setModal={setModal} setForm={setForm} setFormError={setFormError} archiver={archiver} supprimer={supprimer} delGarant={delGarant} delOccupant={delOccupant} />)}
        </>
      )}

      {/* MODALS */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">
                {modal.type==='create' ? '👤 Nouveau locataire'
                  : modal.type==='garant' ? '🛡️ Ajouter un garant'
                  : '👥 Ajouter un occupant'}
              </span>
              <button className="modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              {formError && <div className="alert alert-error">{formError}</div>}

              {modal.type === 'create' && (
                <>
                  <div className="grid2">
                    <div className="fld"><label>Prénom *</label><input value={form.prenom||''} onChange={e=>set('prenom',e.target.value)} /></div>
                    <div className="fld"><label>Nom *</label><input value={form.nom||''} onChange={e=>set('nom',e.target.value)} /></div>
                  </div>
                  <div className="grid2">
                    <div className="fld"><label>Email</label><input type="email" value={form.email||''} onChange={e=>set('email',e.target.value)} /></div>
                    <div className="fld"><label>Téléphone</label><input value={form.telephone||''} onChange={e=>set('telephone',e.target.value)} /></div>
                  </div>
                  <div className="fld">
                    <label>Date de naissance</label>
                    <input type="date" value={form.dob||''} onChange={e=>set('dob',e.target.value)} />
                  </div>
                  <div className="fld">
                    <label>UUID du compte (si déjà créé)</label>
                    <input value={form.user_id||''} onChange={e=>set('user_id',e.target.value)} placeholder="Laisser vide sinon" />
                  </div>
                  <div className="fld">
                    <label>Bien *</label>
                    <select value={form.bien_id||''} onChange={e=>set('bien_id',e.target.value)}>
                      <option value="">— Choisir un bien —</option>
                      {biens.map(b => <option key={b.id} value={b.id}>{b.adresse}, {b.ville}</option>)}
                    </select>
                  </div>
                  <div className="fld">
                    <label>Type de contrat</label>
                    <select value={form.type_contrat||''} onChange={e=>set('type_contrat',e.target.value)}>
                      <option value="">— Choisir —</option>
                      {CONTRATS.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
                    </select>
                  </div>
                  <div className="grid2">
                    <div className="fld"><label>Loyer HC (€) *</label><input type="number" value={form.loyer||''} onChange={e=>set('loyer',e.target.value)} /></div>
                    <div className="fld"><label>Charges (€)</label><input type="number" value={form.charges||''} onChange={e=>set('charges',e.target.value)} /></div>
                  </div>
                  <div className="grid2">
                    <div className="fld"><label>Date d'entrée *</label><input type="date" value={form.date_debut||''} onChange={e=>set('date_debut',e.target.value)} /></div>
                    <div className="fld"><label>Date de sortie prévue</label><input type="date" value={form.date_fin||''} onChange={e=>set('date_fin',e.target.value)} /></div>
                  </div>
                  <button className="btn btn-primary" onClick={createLocataire} disabled={saving}>
                    {saving ? 'Création…' : '✅ Créer le locataire'}
                  </button>
                </>
              )}

              {modal.type === 'garant' && (
                <>
                  <div className="grid2">
                    <div className="fld"><label>Prénom *</label><input value={form.g_prenom||''} onChange={e=>set('g_prenom',e.target.value)} /></div>
                    <div className="fld"><label>Nom *</label><input value={form.g_nom||''} onChange={e=>set('g_nom',e.target.value)} /></div>
                  </div>
                  <div className="grid2">
                    <div className="fld"><label>Téléphone</label><input value={form.g_tel||''} onChange={e=>set('g_tel',e.target.value)} /></div>
                    <div className="fld"><label>Email</label><input type="email" value={form.g_email||''} onChange={e=>set('g_email',e.target.value)} /></div>
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
                      {[['physique','Personne physique'],['morale','Personne morale'],['visale','Visale'],['bancaire','Bancaire']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div className="fld"><label>Montant garanti (€)</label><input type="number" value={form.g_montant||''} onChange={e=>set('g_montant',e.target.value)} /></div>
                  <button className="btn btn-primary" onClick={addGarant} disabled={saving}>{saving?'…':'🛡️ Ajouter'}</button>
                </>
              )}

              {modal.type === 'occupant' && (
                <>
                  <div className="grid2">
                    <div className="fld"><label>Prénom *</label><input value={form.o_prenom||''} onChange={e=>set('o_prenom',e.target.value)} /></div>
                    <div className="fld"><label>Nom *</label><input value={form.o_nom||''} onChange={e=>set('o_nom',e.target.value)} /></div>
                  </div>
                  <div className="grid2">
                    <div className="fld"><label>Date de naissance</label><input type="date" value={form.o_dob||''} onChange={e=>set('o_dob',e.target.value)} /></div>
                    <div className="fld"><label>Lien</label>
                      <select value={form.o_lien||'autre'} onChange={e=>set('o_lien',e.target.value)}>
                        {['titulaire','conjoint','enfant','colocataire','autre'].map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                  </div>
                  <button className="btn btn-primary" onClick={addOccupant} disabled={saving}>{saving?'…':'+ Ajouter'}</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

function LocCard({ loc, archived, expanded, setExpanded, setModal, setForm, setFormError, archiver, supprimer, delGarant, delOccupant }) {
  const isExp = expanded === loc.id
  const locataire = loc.profiles
  const titulaire = loc.occupants?.find(o => o.lien === 'titulaire')
  const nomAffiche = locataire
    ? `${locataire.prenom} ${locataire.nom}`
    : titulaire ? `${titulaire.prenom} ${titulaire.nom} ⚠️ compte non créé` : '— Sans compte'

  return (
    <div className="card" style={{ marginBottom:10, opacity: archived ? .75 : 1 }}>
      <div className="card-header" style={{ cursor:'pointer' }} onClick={() => setExpanded(isExp ? null : loc.id)}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:36, height:36, borderRadius:'50%', background: archived?'#F7F5F0':'#EBF2FC', color: archived?'#9E9890':'#2B5EA7', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, flexShrink:0 }}>
            {nomAffiche.slice(0,1)}{nomAffiche.split(' ')?.[1]?.[0]||''}
          </div>
          <div>
            <div style={{ fontWeight:600, fontSize:14 }}>{nomAffiche}</div>
            <div style={{ fontSize:12, color:'#6B6560' }}>
              {loc.biens?.adresse}, {loc.biens?.ville}
              {loc.loyer_mensuel ? ` · ${Number(loc.loyer_mensuel).toLocaleString('fr-FR')} €/mois` : ''}
              {loc.date_debut ? ` · ${new Date(loc.date_debut).toLocaleDateString('fr-FR')}` : ''}
              {loc.date_fin ? ` → ${new Date(loc.date_fin).toLocaleDateString('fr-FR')}` : ''}
            </div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span className={`status ${loc.statut==='actif'?'status-green':'status-grey'}`}>{loc.statut}</span>
          {loc.type_contrat && <span className="status status-blue" style={{ fontSize:10 }}>{loc.type_contrat.replace(/_/g,' ')}</span>}
          <span style={{ color:'#9E9890', fontSize:16 }}>{isExp?'▲':'▼'}</span>
        </div>
      </div>

      {isExp && (
        <div className="card-body">
          {/* Coordonnées */}
          {locataire && (
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#9E9890', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:6 }}>Coordonnées</div>
              <div style={{ fontSize:13, display:'flex', gap:16, flexWrap:'wrap' }}>
                {locataire.telephone && <span>📞 {locataire.telephone}</span>}
                {locataire.telephone2 && <span>📞 {locataire.telephone2}</span>}
                {locataire.email && <span>✉️ {locataire.email}</span>}
              </div>
            </div>
          )}

          {/* Occupants */}
          {(loc.occupants||[]).length > 0 && (
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#9E9890', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:6 }}>
                👥 Occupants ({loc.occupants.length})
              </div>
              {loc.occupants.map(o => (
                <div key={o.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 0', borderBottom:'1px solid rgba(0,0,0,.04)' }}>
                  <span style={{ fontSize:13 }}>
                    {o.prenom} {o.nom}
                    <span style={{ color:'#9E9890', fontSize:11, marginLeft:6 }}>
                      ({o.lien}){o.date_naissance ? ` · ${new Date().getFullYear()-new Date(o.date_naissance).getFullYear()} ans` : ''}
                    </span>
                  </span>
                  <button onClick={() => delOccupant(o.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#B83232', fontSize:14, padding:'2px 6px' }}>✕</button>
                </div>
              ))}
            </div>
          )}

          {/* Garants */}
          {(loc.garants||[]).length > 0 && (
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#9E9890', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:6 }}>
                🛡️ Garants ({loc.garants.length})
              </div>
              {loc.garants.map(g => (
                <div key={g.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 0', borderBottom:'1px solid rgba(0,0,0,.04)' }}>
                  <div>
                    <span style={{ fontSize:13, fontWeight:500 }}>{g.prenom} {g.nom}</span>
                    <span style={{ color:'#9E9890', fontSize:11, marginLeft:6 }}>
                      {g.lien} · {g.type_caution}
                      {g.montant ? ` · ${Number(g.montant).toLocaleString('fr-FR')} €` : ''}
                      {g.telephone ? ` · ${g.telephone}` : ''}
                    </span>
                  </div>
                  <button onClick={() => delGarant(g.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#B83232', fontSize:14, padding:'2px 6px' }}>✕</button>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', paddingTop:8, borderTop:'1px solid rgba(0,0,0,.07)' }}>
            {!archived && (
              <>
                <button className="btn btn-secondary btn-sm" onClick={() => { setFormError(''); setForm({}); setModal({ type:'occupant', locationId:loc.id }) }}>+ Occupant</button>
                <button className="btn btn-secondary btn-sm" onClick={() => { setFormError(''); setForm({}); setModal({ type:'garant', locationId:loc.id }) }}>+ Garant</button>
                <button className="btn btn-danger btn-sm" onClick={() => archiver(loc.id)}>📦 Archiver</button>
              </>
            )}
            <button className="btn btn-danger btn-sm" onClick={() => supprimer(loc.id)}>🗑️ Supprimer définitivement</button>
          </div>
        </div>
      )}
    </div>
  )
}
