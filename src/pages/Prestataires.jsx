import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const SPE = [
  'Plomberie','Électricité','Chauffage / Climatisation','Serrurerie',
  'Menuiserie / Vitrage','Peinture / Revêtements','Maçonnerie / Carrelage',
  'Couverture / Toiture','Jardinage / Espaces verts','Nettoyage / Entretien',
  'Ascenseur','Automatisme / Portail','Téléphonie / Réseau','Déménagement',
  'Électroménager','Nuisibles / Dératisation','Ramonage','Multi-services',
]
const ICO = {
  'Plomberie':'🚰','Électricité':'⚡','Chauffage / Climatisation':'🌡️',
  'Serrurerie':'🔐','Menuiserie / Vitrage':'🪟','Peinture / Revêtements':'🎨',
  'Maçonnerie / Carrelage':'🧱','Couverture / Toiture':'🏠',
  'Jardinage / Espaces verts':'🌿','Nettoyage / Entretien':'🧹',
  'Ascenseur':'🛗','Automatisme / Portail':'🚧','Téléphonie / Réseau':'📡',
  'Déménagement':'🚛','Électroménager':'🔌','Nuisibles / Dératisation':'🐀',
  'Ramonage':'🏭','Multi-services':'🔧',
}

export default function Prestataires() {
  const { session, profile } = useAuth()
  const [items,   setItems]   = useState([])
  const [biens,   setBiens]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [modal,   setModal]   = useState(null)  // null | {} | {id, ...}
  const [form,    setForm]    = useState({})
  const [saving,  setSaving]  = useState(false)
  const [formErr, setFormErr] = useState('')
  const [search,  setSearch]  = useState('')
  const [filterSpe, setFilter] = useState('')
  const [ficheId, setFicheId] = useState(null)  // prestataire dont on voit la fiche

  const load = useCallback(async () => {
    if (!session?.user || !profile?.role) return
    setLoading(true); setError(null)
    try {
      const isAdmin = profile.role === 'admin'
      const [pR, bR] = await Promise.all([
        // Charger les prestataires du proprio/agence, ou tous si admin
        isAdmin
          ? supabase.from('prestataires').select('*').order('nom')
          : supabase.from('prestataires').select('*').eq('cree_par', session.user.id).order('nom'),
        isAdmin
          ? supabase.from('biens').select('id, adresse, ville')
          : supabase.from('biens').select('id, adresse, ville').eq('proprietaire_id', session.user.id),
      ])
      setItems(pR.data || [])
      setBiens(bR.data || [])
    } catch(e) { setError(e.message) }
    finally { setLoading(false) }
  }, [session?.user?.id, profile?.role])

  useEffect(() => { load() }, [load])

  function set(k, v) { setForm(f => ({...f, [k]: v})) }

  const allSpes = [...new Set([...SPE, ...items.map(p => p.specialite).filter(Boolean)])].sort()
  const filtered = items.filter(p => {
    const ms = !search || `${p.nom||''} ${p.prenom||''} ${p.societe||''}`.toLowerCase().includes(search.toLowerCase())
    return ms && (!filterSpe || p.specialite === filterSpe)
  })

  async function save() {
    if (!form.nom) { setFormErr('Nom obligatoire'); return }
    setSaving(true); setFormErr('')
    try {
      const pl = {
        nom: form.nom, prenom: form.prenom || null,
        societe: form.societe || null, telephone: form.telephone || null,
        telephone2: form.telephone2 || null, email: form.email || null,
        site_web: form.site_web || null, specialite: form.specialite || null,
        adresse: form.adresse || null, ville: form.ville || null,
        siret: form.siret || null, assurance: form.assurance || null,
        tarif_horaire: form.tarif_horaire ? Number(form.tarif_horaire) : null,
        disponibilite: form.disponibilite || null,
        notes: form.notes || null,
        cree_par: session.user.id,
      }
      let prestaId
      if (modal.id) {
        await supabase.from('prestataires').update(pl).eq('id', modal.id)
        prestaId = modal.id
      } else {
        const { data: d, error: e } = await supabase.from('prestataires').insert(pl).select().single()
        if (e) throw e
        prestaId = d.id
      }
      // Associer aux biens sélectionnés
      if (form.bien_ids && form.bien_ids.length > 0) {
        await supabase.from('prestataire_biens').delete().eq('prestataire_id', prestaId)
        await supabase.from('prestataire_biens').insert(
          form.bien_ids.map(bid => ({ prestataire_id: prestaId, bien_id: bid }))
        )
      }
      setModal(null); load()
    } catch(e) { setFormErr(e.message) }
    finally { setSaving(false) }
  }

  async function del(id) {
    if (!window.confirm('Supprimer ce prestataire ?')) return
    await supabase.from('prestataires').delete().eq('id', id)
    load()
  }

  const fiche = ficheId ? items.find(p => p.id === ficheId) : null

  if (loading) return <Layout><div className="it-center"><div className="it-spinner"/></div></Layout>
  if (error)   return (
    <Layout>
      <div className="it-center">
        <div className="alert alert-error" style={{maxWidth:360, textAlign:'center'}}>
          {error}<br/>
          <button className="btn btn-secondary btn-sm" style={{marginTop:8}} onClick={load}>Réessayer</button>
        </div>
      </div>
    </Layout>
  )

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Prestataires</h1>
          <p className="page-sub">{items.length} prestataire(s) enregistré(s)</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm({}); setFormErr(''); setModal({}) }}>
          + Ajouter
        </button>
      </div>

      <div style={{marginBottom:16, background:'#EBF2FC', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#2B5EA7'}}>
        <strong>Fonctionnement :</strong> Les prestataires sont des contacts d'intervention (artisans, sociétés). Associez-les à vos biens pour que les locataires puissent les contacter directement depuis la fiche de l'équipement en panne.
      </div>

      {/* Filtres */}
      <div style={{display:'flex', gap:8, marginBottom:14, flexWrap:'wrap'}}>
        <input
          style={{padding:'7px 12px', border:'1px solid rgba(0,0,0,.15)', borderRadius:8, fontFamily:'inherit', fontSize:13, outline:'none', flex:1, minWidth:160}}
          placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)}/>
        <select
          style={{padding:'7px 12px', border:'1px solid rgba(0,0,0,.15)', borderRadius:8, fontFamily:'inherit', fontSize:13, outline:'none', background:'#fff'}}
          value={filterSpe} onChange={e => setFilter(e.target.value)}>
          <option value="">Toutes spécialités</option>
          {[...new Set(items.map(p => p.specialite).filter(Boolean))].sort().map(s => (
            <option key={s} value={s}>{ICO[s] || '🔧'} {s}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 && (
        <div className="card">
          <div className="card-body" style={{textAlign:'center', padding:40, color:'#9E9890'}}>
            {items.length === 0 ? 'Ajoutez vos artisans et entreprises de confiance.' : 'Aucun résultat.'}
          </div>
        </div>
      )}

      <div className="grid3" style={{gap:12}}>
        {filtered.map(p => (
          <div key={p.id} className="card" style={{cursor:'pointer'}} onClick={() => setFicheId(p.id)}>
            <div className="card-body" style={{padding:14}}>
              <div style={{display:'flex', alignItems:'flex-start', gap:10, marginBottom:8}}>
                <div style={{width:42, height:42, borderRadius:'50%', background:'#FDF3E7', color:'#C8813A', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0}}>
                  {ICO[p.specialite] || '🔧'}
                </div>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontWeight:600, fontSize:14, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                    {p.prenom ? `${p.prenom} ${p.nom}` : p.nom}
                  </div>
                  {p.societe && <div style={{fontSize:12, color:'#6B6560'}}>{p.societe}</div>}
                </div>
              </div>
              {p.specialite && (
                <span style={{display:'inline-block', padding:'3px 9px', borderRadius:20, fontSize:11, fontWeight:600, background:'#FDF3E7', color:'#C8813A', marginBottom:6}}>
                  {ICO[p.specialite] || '🔧'} {p.specialite}
                </span>
              )}
              {p.telephone && <div style={{fontSize:12, color:'#6B6560', marginBottom:2}}>📞 {p.telephone}</div>}
              {p.email     && <div style={{fontSize:12, color:'#6B6560', marginBottom:2}}>✉️ {p.email}</div>}
              {p.site_web  && <div style={{fontSize:12, color:'#2B5EA7', marginBottom:2}}>🌐 {p.site_web}</div>}
              {p.notes     && <div style={{fontSize:11, color:'#9E9890', marginTop:4, lineHeight:1.4}}>{p.notes}</div>}
              <div style={{display:'flex', gap:5, marginTop:10}}>
                <button className="btn btn-secondary btn-sm" style={{flex:1}} onClick={e => { e.stopPropagation(); setForm({...p, bien_ids:[]}); setFormErr(''); setModal(p) }}>
                  ✏️ Modifier
                </button>
                <button className="btn btn-danger btn-sm" onClick={e => { e.stopPropagation(); del(p.id) }}>🗑️</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Fiche prestataire (popup) */}
      {fiche && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setFicheId(null)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <div style={{display:'flex', alignItems:'center', gap:10}}>
                <div style={{width:44, height:44, borderRadius:'50%', background:'#FDF3E7', color:'#C8813A', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22}}>
                  {ICO[fiche.specialite] || '🔧'}
                </div>
                <div>
                  <span className="modal-title">{fiche.prenom ? `${fiche.prenom} ${fiche.nom}` : fiche.nom}</span>
                  {fiche.specialite && <div style={{fontSize:12, color:'#C8813A'}}>{fiche.specialite}</div>}
                </div>
              </div>
              <button className="modal-close" onClick={() => setFicheId(null)}>✕</button>
            </div>
            <div className="modal-body">
              {fiche.societe && (
                <div style={{fontSize:14, fontWeight:500, marginBottom:6}}>🏢 {fiche.societe}</div>
              )}
              <div style={{display:'flex', gap:14, flexWrap:'wrap', marginBottom:10}}>
                {fiche.telephone  && <a href={`tel:${fiche.telephone}`}  style={{fontSize:14, color:'#2B5EA7', textDecoration:'none'}}>📞 {fiche.telephone}</a>}
                {fiche.telephone2 && <a href={`tel:${fiche.telephone2}`} style={{fontSize:14, color:'#2B5EA7', textDecoration:'none'}}>📞 {fiche.telephone2}</a>}
                {fiche.email      && <a href={`mailto:${fiche.email}`}   style={{fontSize:14, color:'#2B5EA7', textDecoration:'none'}}>✉️ {fiche.email}</a>}
                {fiche.site_web   && <a href={fiche.site_web} target="_blank" rel="noopener noreferrer" style={{fontSize:14, color:'#2B5EA7', textDecoration:'none'}}>🌐 {fiche.site_web}</a>}
              </div>
              {fiche.adresse && <div style={{fontSize:13, color:'#6B6560', marginBottom:4}}>📍 {fiche.adresse}{fiche.ville ? ', ' + fiche.ville : ''}</div>}
              {fiche.siret      && <div style={{fontSize:12, color:'#9E9890', marginBottom:4}}>SIRET : {fiche.siret}</div>}
              {fiche.assurance  && <div style={{fontSize:12, color:'#9E9890', marginBottom:4}}>Assurance : {fiche.assurance}</div>}
              {fiche.tarif_horaire && <div style={{fontSize:13, color:'#6B6560', marginBottom:4}}>Tarif : {fiche.tarif_horaire} €/h</div>}
              {fiche.disponibilite && <div style={{fontSize:13, color:'#6B6560', marginBottom:4}}>Disponibilité : {fiche.disponibilite}</div>}
              {fiche.notes && (
                <div style={{background:'#F7F5F0', borderRadius:8, padding:'10px 12px', marginTop:8, fontSize:13, color:'#1A1714', lineHeight:1.6}}>
                  {fiche.notes}
                </div>
              )}
              <div style={{display:'flex', gap:8, marginTop:12}}>
                {fiche.telephone && <a href={`tel:${fiche.telephone}`} className="btn btn-primary">📞 Appeler</a>}
                {fiche.email     && <a href={`mailto:${fiche.email}`}  className="btn btn-secondary">✉️ Email</a>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal ajout/modif */}
      {modal !== null && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setModal(null)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <span className="modal-title">{modal.id ? 'Modifier le prestataire' : 'Nouveau prestataire'}</span>
              <button className="modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              {formErr && <div className="alert alert-error">{formErr}</div>}
              <div className="grid2">
                <div className="fld"><label>Prénom</label><input value={form.prenom||''} onChange={e=>set('prenom',e.target.value)}/></div>
                <div className="fld"><label>Nom *</label><input value={form.nom||''} onChange={e=>set('nom',e.target.value)}/></div>
              </div>
              <div className="fld"><label>Société / Raison sociale</label><input value={form.societe||''} onChange={e=>set('societe',e.target.value)}/></div>
              <div className="fld">
                <label>Spécialité</label>
                <select value={form.specialite||''} onChange={e=>set('specialite',e.target.value)}>
                  <option value="">— Choisir —</option>
                  {allSpes.map(s => <option key={s} value={s}>{ICO[s]||'🔧'} {s}</option>)}
                </select>
              </div>
              <div className="grid2">
                <div className="fld"><label>Téléphone principal</label><input value={form.telephone||''} onChange={e=>set('telephone',e.target.value)}/></div>
                <div className="fld"><label>Téléphone secondaire</label><input value={form.telephone2||''} onChange={e=>set('telephone2',e.target.value)}/></div>
              </div>
              <div className="grid2">
                <div className="fld"><label>Email</label><input type="email" value={form.email||''} onChange={e=>set('email',e.target.value)}/></div>
                <div className="fld"><label>Site web</label><input value={form.site_web||''} onChange={e=>set('site_web',e.target.value)} placeholder="https://..."/></div>
              </div>
              <div className="grid2">
                <div className="fld"><label>Adresse</label><input value={form.adresse||''} onChange={e=>set('adresse',e.target.value)}/></div>
                <div className="fld"><label>Ville</label><input value={form.ville||''} onChange={e=>set('ville',e.target.value)}/></div>
              </div>
              <div className="grid2">
                <div className="fld"><label>SIRET</label><input value={form.siret||''} onChange={e=>set('siret',e.target.value)}/></div>
                <div className="fld"><label>Assurance décennale</label><input value={form.assurance||''} onChange={e=>set('assurance',e.target.value)} placeholder="N° de police ou assureur"/></div>
              </div>
              <div className="grid2">
                <div className="fld"><label>Tarif horaire (€)</label><input type="number" value={form.tarif_horaire||''} onChange={e=>set('tarif_horaire',e.target.value)}/></div>
                <div className="fld"><label>Disponibilité</label><input value={form.disponibilite||''} onChange={e=>set('disponibilite',e.target.value)} placeholder="Lun-Ven 8h-18h, urgences 24h/24..."/></div>
              </div>
              {biens.length > 0 && (
                <div className="fld">
                  <label>Biens associés (où ce prestataire intervient)</label>
                  <div style={{display:'flex', flexDirection:'column', gap:4, padding:'6px 0'}}>
                    {biens.map(b => (
                      <label key={b.id} style={{display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13}}>
                        <input type="checkbox"
                          checked={(form.bien_ids||[]).includes(b.id)}
                          onChange={e => {
                            const cur = form.bien_ids || []
                            set('bien_ids', e.target.checked ? [...cur, b.id] : cur.filter(id => id !== b.id))
                          }}/>
                        {b.adresse}, {b.ville}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="fld"><label>Notes / Observations</label><textarea value={form.notes||''} onChange={e=>set('notes',e.target.value)} placeholder="Qualité du travail, délais, tarifs..."/></div>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Enregistrement...' : '💾 Enregistrer'}</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
