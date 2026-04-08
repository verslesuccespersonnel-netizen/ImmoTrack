import React, { useState, useEffect } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const MOYENS_PAIEMENT = ['Virement bancaire','Chèque','Espèces','Prélèvement automatique','Carte bancaire','Mandat postal','Autre']
const TYPES_CAUTION   = [{v:'physique',l:'Personne physique'},{v:'morale',l:'Personne morale'},{v:'visale',l:'Visale (Action Logement)'},{v:'bancaire',l:'Caution bancaire'},{v:'garantme',l:'GarantMe / Unkle'},{v:'autre',l:'Autre organisme'}]
const TYPES_LOCATION  = [{v:'vide',l:'Bail vide (non meublé)'},{v:'meuble',l:'Bail meublé'},{v:'commercial',l:'Bail commercial (9 ans)'},{v:'professionnel',l:'Bail professionnel'},{v:'mixte',l:'Bail mixte habitation/pro'},{v:'courte_duree',l:'Courte durée (Airbnb, etc.)'},{v:'saisonnier',l:'Saisonnier'},{v:'autre',l:'Autre'}]
const USAGES          = [{v:'habitation',l:'Habitation principale'},{v:'secondaire',l:'Résidence secondaire'},{v:'professionnel',l:'Usage professionnel'},{v:'commercial',l:'Usage commercial'},{v:'mixte',l:'Mixte habitation/pro'}]
const PLATEFORMES     = ['Airbnb','Booking.com','Abritel/Vrbo','Gîtes de France','Clévacances','Direct (site perso)','Autre']

export default function Locataires() {
  const { session } = useAuth()
  const [locs,    setLocs]    = useState([])
  const [biens,   setBiens]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [showArchives, setShowArchives] = useState(false)
  const [expanded, setExpanded]         = useState(null)
  const [modal,   setModal]   = useState(null)
  const [form,    setForm]    = useState({})
  const [saving,  setSaving]  = useState(false)
  const [formErr, setFormErr] = useState('')
  const [activeTab, setActiveTab] = useState('principal') // pour le formulaire

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
          occupants(*),
          cautions(*)
        `).order('created_at',{ascending:false}),
        supabase.from('biens').select('id,adresse,ville').eq('proprietaire_id',session.user.id),
      ])
      const myIds = new Set((br.data||[]).map(b=>b.id))
      setLocs((lr.data||[]).filter(l=>myIds.has(l.bien_id)))
      setBiens(br.data||[])
    } catch(e) { setError(e.message) }
    finally { setLoading(false) }
  }

  function set(k,v) { setForm(f=>({...f,[k]:v})) }

  // Créer un locataire avec toutes les infos
  async function createLocataire() {
    if (!form.nom||!form.prenom||!form.bien_id||!form.loyer||!form.date_debut) {
      setFormErr('Nom, prénom, bien, loyer et date d\'entrée sont obligatoires.'); return
    }
    setSaving(true); setFormErr('')
    try {
      const isCoutre = form.type_location === 'courte_duree' || form.type_location === 'saisonnier'
      const { data: loc, error: e } = await supabase.from('locations').insert({
        bien_id: form.bien_id,
        locataire_id: form.user_id||null,
        loyer_mensuel: Number(form.loyer),
        charges: form.charges ? Number(form.charges) : 0,
        date_debut: form.date_debut,
        date_fin: form.date_fin||null,
        type_contrat: form.type_location||'vide',
        type_location: form.type_location||'vide',
        meuble: form.meuble||false,
        courte_duree: isCoutre,
        plateforme: isCoutre ? (form.plateforme||null) : null,
        tarif_nuit: isCoutre && form.tarif_nuit ? Number(form.tarif_nuit) : null,
        usage: form.usage||'habitation',
        surface_m2: form.surface_m2 ? Number(form.surface_m2) : null,
        nb_pieces: form.nb_pieces ? Number(form.nb_pieces) : null,
        etage: form.etage||null,
        ascenseur: form.ascenseur||false,
        parking: form.parking||false,
        cave: form.cave||false,
        depot_garantie: form.depot_garantie ? Number(form.depot_garantie) : null,
        depot_verse: form.depot_verse||false,
        depot_verse_date: form.depot_verse_date||null,
        depot_verse_moyen: form.depot_verse_moyen||null,
        depot_verse_ref: form.depot_verse_ref||null,
        assurance_locataire: form.assurance_locataire||null,
        assurance_expiry: form.assurance_expiry||null,
        notes: form.notes||null,
        statut: 'actif',
      }).select().single()
      if (e) throw e

      // Créer l'occupant principal
      await supabase.from('occupants').insert({
        location_id: loc.id, nom: form.nom, prenom: form.prenom,
        lien: 'titulaire', date_naissance: form.dob||null,
      })

      // Créer invitation si pas de compte
      if (!form.user_id && form.email) {
        await supabase.from('invitations').insert({
          email: form.email.toLowerCase().trim(), role: 'locataire',
          nom: form.nom, prenom: form.prenom, telephone: form.telephone||null,
          bien_id: form.bien_id, loyer: Number(form.loyer),
          date_debut: form.date_debut, type_contrat: form.type_location||null,
          cree_par: session.user.id,
        }).catch(()=>{})
      }

      setModal(null); load()
    } catch(e) { setFormErr(e.message) }
    finally { setSaving(false) }
  }

  async function addCaution() {
    if (!form.c_nom) { setFormErr('Nom obligatoire'); return }
    setSaving(true)
    try {
      await supabase.from('cautions').insert({
        location_id: modal.locationId,
        type_caution: form.c_type||'physique',
        nom: form.c_nom, prenom: form.c_prenom||null,
        telephone: form.c_tel||null, email: form.c_email||null,
        adresse: form.c_adresse||null, ville: form.c_ville||null,
        date_naissance: form.c_dob||null,
        profession: form.c_profession||null,
        employeur: form.c_employeur||null,
        revenu_mensuel: form.c_revenu ? Number(form.c_revenu) : null,
        lien_locataire: form.c_lien||null,
        organisme: form.c_organisme||null,
        ref_dossier: form.c_ref||null,
        montant_garanti: form.c_montant ? Number(form.c_montant) : null,
        date_debut: form.c_date_debut||null,
        date_fin: form.c_date_fin||null,
        notes: form.c_notes||null,
      })
      setModal(null); load()
    } catch(e) { setFormErr(e.message) }
    finally { setSaving(false) }
  }

  async function addOccupant() {
    if (!form.o_nom||!form.o_prenom) { setFormErr('Nom et prénom requis'); return }
    await supabase.from('occupants').insert({
      location_id: modal.locationId, nom: form.o_nom, prenom: form.o_prenom,
      lien: form.o_lien||'autre', date_naissance: form.o_dob||null,
    })
    setModal(null); load()
  }

  async function updateDepot(locId, updates) {
    await supabase.from('locations').update(updates).eq('id',locId)
    load()
  }

  async function archiver(id) {
    if (!window.confirm('Archiver cette location ?')) return
    await supabase.from('locations').update({statut:'termine',date_fin:new Date().toISOString().split('T')[0]}).eq('id',id)
    load()
  }

  async function supprimer(id) {
    if (!window.confirm('Supprimer définitivement ?')) return
    await supabase.from('locations').delete().eq('id',id)
    load()
  }

  async function delCaution(id) { await supabase.from('cautions').delete().eq('id',id); load() }
  async function delOccupant(id) { await supabase.from('occupants').delete().eq('id',id); load() }

  const actifs   = locs.filter(l=>l.statut==='actif')
  const archives = locs.filter(l=>l.statut!=='actif')

  if (loading) return <Layout><div className="it-center"><div className="it-spinner"/></div></Layout>
  if (error)   return <Layout><div className="it-center"><div className="alert alert-error">{error}<br/><button className="btn btn-secondary btn-sm" style={{marginTop:8}} onClick={load}>↺</button></div></div></Layout>

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Locataires</h1>
          <p className="page-sub">{actifs.length} actif(s){archives.length>0?` · ${archives.length} archivé(s)`:''}</p>
        </div>
        <div style={{display:'flex',gap:8}}>
          {archives.length>0&&<button className="btn btn-secondary" onClick={()=>setShowArchives(s=>!s)}>{showArchives?'🙈 Masquer':'📦 Archives'}</button>}
          <button className="btn btn-primary" onClick={()=>{setForm({type_location:'vide',usage:'habitation'});setFormErr('');setActiveTab('principal');setModal({type:'create'})}}>+ Ajouter</button>
        </div>
      </div>

      {actifs.length===0&&<div className="card"><div className="card-body" style={{textAlign:'center',padding:40,color:'#9E9890'}}>Aucun locataire actif.</div></div>}
      {actifs.map(l=><LocCard key={l.id} loc={l} expanded={expanded} setExpanded={setExpanded} setModal={setModal} setForm={setForm} setFormErr={setFormErr} archiver={archiver} supprimer={supprimer} delCaution={delCaution} delOccupant={delOccupant} updateDepot={updateDepot}/>)}

      {showArchives&&archives.length>0&&<>
        <div style={{fontSize:12,fontWeight:600,color:'#9E9890',textTransform:'uppercase',letterSpacing:'.05em',margin:'20px 0 10px',display:'flex',alignItems:'center',gap:8}}>
          <span>📦 Archives</span><div style={{flex:1,height:1,background:'rgba(0,0,0,.08)'}}/>
        </div>
        {archives.map(l=><LocCard key={l.id} loc={l} archived expanded={expanded} setExpanded={setExpanded} setModal={setModal} setForm={setForm} setFormErr={setFormErr} archiver={archiver} supprimer={supprimer} delCaution={delCaution} delOccupant={delOccupant} updateDepot={updateDepot}/>)}
      </>}

      {/* ── MODALS ── */}
      {modal&&(
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <span className="modal-title">
                {modal.type==='create'?'👤 Nouveau locataire':modal.type==='caution'?'🛡️ Ajouter une caution/garant':'👥 Ajouter un occupant'}
              </span>
              <button className="modal-close" onClick={()=>setModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              {formErr&&<div className="alert alert-error">{formErr}</div>}

              {modal.type==='create'&&<>
                {/* Onglets du formulaire */}
                <div style={{display:'flex',borderBottom:'1px solid rgba(0,0,0,.08)',marginBottom:14}}>
                  {[['principal','👤 Locataire'],['contrat','📋 Contrat'],['bien','🏠 Bien & logement'],['depot','🔐 Dépôt de garantie'],['autres','📎 Autres']].map(([t,l])=>(
                    <button key={t} onClick={()=>setActiveTab(t)}
                      style={{padding:'7px 12px',border:'none',cursor:'pointer',background:'transparent',fontFamily:'inherit',fontSize:12,fontWeight:500,
                        color:activeTab===t?'#2D5A3D':'#6B6560',borderBottom:activeTab===t?'2px solid #2D5A3D':'2px solid transparent'}}>
                      {l}
                    </button>
                  ))}
                </div>

                {activeTab==='principal'&&<>
                  <div className="grid2">
                    <div className="fld"><label>Prénom *</label><input value={form.prenom||''} onChange={e=>set('prenom',e.target.value)}/></div>
                    <div className="fld"><label>Nom *</label><input value={form.nom||''} onChange={e=>set('nom',e.target.value)}/></div>
                  </div>
                  <div className="grid2">
                    <div className="fld"><label>Date de naissance</label><input type="date" value={form.dob||''} onChange={e=>set('dob',e.target.value)}/></div>
                    <div className="fld"><label>Nationalité</label><input value={form.nationalite||''} onChange={e=>set('nationalite',e.target.value)} placeholder="Française…"/></div>
                  </div>
                  <div className="grid2">
                    <div className="fld"><label>Email</label><input type="email" value={form.email||''} onChange={e=>set('email',e.target.value)}/></div>
                    <div className="fld"><label>Téléphone</label><input value={form.telephone||''} onChange={e=>set('telephone',e.target.value)}/></div>
                  </div>
                  <div className="fld"><label>Adresse actuelle</label><input value={form.adresse_actuelle||''} onChange={e=>set('adresse_actuelle',e.target.value)} placeholder="Adresse avant entrée dans le logement"/></div>
                  <div className="grid2">
                    <div className="fld"><label>Profession</label><input value={form.profession||''} onChange={e=>set('profession',e.target.value)}/></div>
                    <div className="fld"><label>Employeur</label><input value={form.employeur||''} onChange={e=>set('employeur',e.target.value)}/></div>
                  </div>
                  <div className="fld"><label>Revenu mensuel net (€)</label><input type="number" value={form.revenu||''} onChange={e=>set('revenu',e.target.value)} placeholder="Pour évaluer la solvabilité"/></div>
                  <div className="fld"><label>UUID (si compte ImmoTrack déjà créé)</label><input value={form.user_id||''} onChange={e=>set('user_id',e.target.value)} placeholder="Laisser vide sinon — invitation créée automatiquement"/></div>
                </>}

                {activeTab==='contrat'&&<>
                  <div className="fld"><label>Bien *</label><select value={form.bien_id||''} onChange={e=>set('bien_id',e.target.value)}><option value="">— Choisir un bien —</option>{biens.map(b=><option key={b.id} value={b.id}>{b.adresse}, {b.ville}</option>)}</select></div>
                  <div className="fld"><label>Type de location *</label>
                    <select value={form.type_location||'vide'} onChange={e=>set('type_location',e.target.value)}>
                      {TYPES_LOCATION.map(t=><option key={t.v} value={t.v}>{t.l}</option>)}
                    </select>
                  </div>
                  <div className="fld"><label>Usage du logement</label>
                    <select value={form.usage||'habitation'} onChange={e=>set('usage',e.target.value)}>
                      {USAGES.map(u=><option key={u.v} value={u.v}>{u.l}</option>)}
                    </select>
                  </div>
                  {(form.type_location==='courte_duree'||form.type_location==='saisonnier')&&<>
                    <div className="grid2">
                      <div className="fld"><label>Plateforme</label><select value={form.plateforme||''} onChange={e=>set('plateforme',e.target.value)}><option value="">—</option>{PLATEFORMES.map(p=><option key={p}>{p}</option>)}</select></div>
                      <div className="fld"><label>Tarif / nuit (€)</label><input type="number" value={form.tarif_nuit||''} onChange={e=>set('tarif_nuit',e.target.value)}/></div>
                    </div>
                  </>}
                  <div className="grid2">
                    <div className="fld"><label>Loyer mensuel HC (€) *</label><input type="number" value={form.loyer||''} onChange={e=>set('loyer',e.target.value)}/></div>
                    <div className="fld"><label>Charges (€/mois)</label><input type="number" value={form.charges||''} onChange={e=>set('charges',e.target.value)} placeholder="Provisions sur charges"/></div>
                  </div>
                  <div className="grid2">
                    <div className="fld"><label>Date d'entrée *</label><input type="date" value={form.date_debut||''} onChange={e=>set('date_debut',e.target.value)}/></div>
                    <div className="fld"><label>Date de sortie prévue</label><input type="date" value={form.date_fin||''} onChange={e=>set('date_fin',e.target.value)}/></div>
                  </div>
                  <div className="grid2">
                    <div className="fld"><label>Assurance habitation</label><input value={form.assurance_locataire||''} onChange={e=>set('assurance_locataire',e.target.value)} placeholder="Nom de l'assureur"/></div>
                    <div className="fld"><label>Expiration assurance</label><input type="date" value={form.assurance_expiry||''} onChange={e=>set('assurance_expiry',e.target.value)}/></div>
                  </div>
                </>}

                {activeTab==='bien'&&<>
                  <div className="grid2">
                    <div className="fld"><label>Surface (m²)</label><input type="number" value={form.surface_m2||''} onChange={e=>set('surface_m2',e.target.value)}/></div>
                    <div className="fld"><label>Nombre de pièces</label><input type="number" value={form.nb_pieces||''} onChange={e=>set('nb_pieces',e.target.value)}/></div>
                  </div>
                  <div className="grid2">
                    <div className="fld"><label>Étage</label><input value={form.etage||''} onChange={e=>set('etage',e.target.value)} placeholder="RDC, 1er, 2ème…"/></div>
                    <div></div>
                  </div>
                  <div style={{display:'flex',gap:16,flexWrap:'wrap',padding:'10px 0'}}>
                    {[['meuble','🛋️ Meublé'],['ascenseur','🛗 Ascenseur'],['parking','🚗 Parking'],['cave','📦 Cave']].map(([k,l])=>(
                      <label key={k} style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',fontSize:13}}>
                        <input type="checkbox" checked={form[k]||false} onChange={e=>set(k,e.target.checked)} style={{cursor:'pointer'}}/>
                        {l}
                      </label>
                    ))}
                  </div>
                  <div style={{borderTop:'1px solid rgba(0,0,0,.07)',paddingTop:12,marginTop:4}}>
                    <div style={{fontSize:11,fontWeight:700,color:'#9E9890',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:8}}>Relevés compteurs — État des lieux d'entrée</div>
                    <div className="grid3">
                      <div className="fld"><label>Eau (m³)</label><input type="number" value={form.index_entree_eau||''} onChange={e=>set('index_entree_eau',e.target.value)}/></div>
                      <div className="fld"><label>Électricité (kWh)</label><input type="number" value={form.index_entree_elec||''} onChange={e=>set('index_entree_elec',e.target.value)}/></div>
                      <div className="fld"><label>Gaz (m³)</label><input type="number" value={form.index_entree_gaz||''} onChange={e=>set('index_entree_gaz',e.target.value)}/></div>
                    </div>
                  </div>
                </>}

                {activeTab==='depot'&&<>
                  <div className="alert alert-info" style={{fontSize:12}}>
                    Le dépôt de garantie couvre les éventuels impayés et dégradations. Il est limité par la loi : 1 mois de loyer HC pour un bail vide, 2 mois pour un meublé.
                  </div>
                  <div className="fld"><label>Montant du dépôt de garantie (€)</label><input type="number" value={form.depot_garantie||''} onChange={e=>set('depot_garantie',e.target.value)}/></div>
                  <div style={{background:'#E8F2EB',borderRadius:8,padding:'12px 14px',marginTop:4}}>
                    <div style={{fontSize:11,fontWeight:700,color:'#2D5A3D',textTransform:'uppercase',marginBottom:8}}>Versement</div>
                    <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',marginBottom:8,fontSize:13}}>
                      <input type="checkbox" checked={form.depot_verse||false} onChange={e=>set('depot_verse',e.target.checked)}/>
                      Dépôt versé par le locataire
                    </label>
                    {form.depot_verse&&<div className="grid2" style={{marginTop:4}}>
                      <div className="fld"><label>Date de versement</label><input type="date" value={form.depot_verse_date||''} onChange={e=>set('depot_verse_date',e.target.value)}/></div>
                      <div className="fld"><label>Moyen de paiement</label><select value={form.depot_verse_moyen||''} onChange={e=>set('depot_verse_moyen',e.target.value)}><option value="">—</option>{MOYENS_PAIEMENT.map(m=><option key={m}>{m}</option>)}</select></div>
                      <div className="fld"><label>Référence / N° chèque</label><input value={form.depot_verse_ref||''} onChange={e=>set('depot_verse_ref',e.target.value)} placeholder="N° de chèque ou virement…"/></div>
                    </div>}
                  </div>
                </>}

                {activeTab==='autres'&&<>
                  <div className="fld"><label>Notes / Observations</label><textarea value={form.notes||''} onChange={e=>set('notes',e.target.value)} placeholder="Conditions particulières, remarques…" style={{minHeight:100}}/></div>
                </>}

                <div style={{display:'flex',gap:8,marginTop:8}}>
                  {activeTab!=='principal'&&<button className="btn btn-secondary" onClick={()=>{const tabs=['principal','contrat','bien','depot','autres'];setActiveTab(t=>tabs[tabs.indexOf(t)-1]||t)}}>← Précédent</button>}
                  {activeTab!=='autres'
                    ?<button className="btn btn-primary" onClick={()=>{const tabs=['principal','contrat','bien','depot','autres'];setActiveTab(t=>tabs[tabs.indexOf(t)+1]||t)}}>Suivant →</button>
                    :<button className="btn btn-primary" onClick={createLocataire} disabled={saving}>{saving?'Création…':'✅ Créer le locataire'}</button>
                  }
                </div>
              </>}

              {modal.type==='caution'&&<>
                <div className="fld"><label>Type de caution</label>
                  <select value={form.c_type||'physique'} onChange={e=>set('c_type',e.target.value)}>
                    {TYPES_CAUTION.map(t=><option key={t.v} value={t.v}>{t.l}</option>)}
                  </select>
                </div>
                {(form.c_type||'physique')==='physique'&&<>
                  <div className="grid2">
                    <div className="fld"><label>Prénom</label><input value={form.c_prenom||''} onChange={e=>set('c_prenom',e.target.value)}/></div>
                    <div className="fld"><label>Nom *</label><input value={form.c_nom||''} onChange={e=>set('c_nom',e.target.value)}/></div>
                  </div>
                  <div className="grid2">
                    <div className="fld"><label>Date de naissance</label><input type="date" value={form.c_dob||''} onChange={e=>set('c_dob',e.target.value)}/></div>
                    <div className="fld"><label>Lien avec le locataire</label><input value={form.c_lien||''} onChange={e=>set('c_lien',e.target.value)} placeholder="Parent, conjoint, ami…"/></div>
                  </div>
                  <div className="grid2">
                    <div className="fld"><label>Téléphone</label><input value={form.c_tel||''} onChange={e=>set('c_tel',e.target.value)}/></div>
                    <div className="fld"><label>Email</label><input type="email" value={form.c_email||''} onChange={e=>set('c_email',e.target.value)}/></div>
                  </div>
                  <div className="fld"><label>Adresse</label><input value={form.c_adresse||''} onChange={e=>set('c_adresse',e.target.value)}/></div>
                  <div className="grid2">
                    <div className="fld"><label>Profession</label><input value={form.c_profession||''} onChange={e=>set('c_profession',e.target.value)}/></div>
                    <div className="fld"><label>Employeur</label><input value={form.c_employeur||''} onChange={e=>set('c_employeur',e.target.value)}/></div>
                  </div>
                  <div className="fld"><label>Revenu mensuel net (€)</label><input type="number" value={form.c_revenu||''} onChange={e=>set('c_revenu',e.target.value)}/></div>
                </>}
                {(form.c_type==='morale'||form.c_type==='visale'||form.c_type==='bancaire'||form.c_type==='garantme')&&<>
                  <div className="fld"><label>Nom de l'organisme *</label><input value={form.c_nom||''} onChange={e=>set('c_nom',e.target.value)}/></div>
                  <div className="fld"><label>Référence dossier</label><input value={form.c_ref||''} onChange={e=>set('c_ref',e.target.value)}/></div>
                </>}
                <div className="grid2">
                  <div className="fld"><label>Montant garanti (€)</label><input type="number" value={form.c_montant||''} onChange={e=>set('c_montant',e.target.value)} placeholder="Laisser vide = illimité"/></div>
                  <div className="fld"><label>Validité (fin)</label><input type="date" value={form.c_date_fin||''} onChange={e=>set('c_date_fin',e.target.value)}/></div>
                </div>
                <div className="fld"><label>Notes</label><textarea value={form.c_notes||''} onChange={e=>set('c_notes',e.target.value)}/></div>
                <button className="btn btn-primary" onClick={addCaution} disabled={saving}>{saving?'…':'🛡️ Ajouter la caution'}</button>
              </>}

              {modal.type==='occupant'&&<>
                <div className="grid2">
                  <div className="fld"><label>Prénom *</label><input value={form.o_prenom||''} onChange={e=>set('o_prenom',e.target.value)}/></div>
                  <div className="fld"><label>Nom *</label><input value={form.o_nom||''} onChange={e=>set('o_nom',e.target.value)}/></div>
                </div>
                <div className="grid2">
                  <div className="fld"><label>Naissance</label><input type="date" value={form.o_dob||''} onChange={e=>set('o_dob',e.target.value)}/></div>
                  <div className="fld"><label>Lien</label><select value={form.o_lien||'autre'} onChange={e=>set('o_lien',e.target.value)}>{['titulaire','conjoint','enfant','colocataire','autre'].map(l=><option key={l}>{l}</option>)}</select></div>
                </div>
                <button className="btn btn-primary" onClick={addOccupant}>+ Ajouter</button>
              </>}
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

function LocCard({loc,archived,expanded,setExpanded,setModal,setForm,setFormErr,archiver,supprimer,delCaution,delOccupant,updateDepot}) {
  const [showDepot,setShowDepot] = useState(false)
  const [depotForm,setDepotForm] = useState({})
  const isExp = expanded===loc.id
  const p = loc.profiles
  const t = loc.occupants?.find(o=>o.lien==='titulaire')
  const nom = p?`${p.prenom} ${p.nom}`:t?`${t.prenom} ${t.nom} ⚠️`:'—'
  const isCourte = loc.courte_duree || loc.type_location==='courte_duree'

  const typeLabel = {
    vide:'Bail vide',meuble:'Bail meublé',commercial:'Bail commercial',
    professionnel:'Bail professionnel',mixte:'Mixte',
    courte_duree:'Courte durée',saisonnier:'Saisonnier',autre:'Autre'
  }[loc.type_location||loc.type_contrat||'vide']

  return(
    <div className="card" style={{marginBottom:10,opacity:archived?.75:1}}>
      <div className="card-header" style={{cursor:'pointer'}} onClick={()=>setExpanded(isExp?null:loc.id)}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:36,height:36,borderRadius:'50%',background:archived?'#F7F5F0':'#EBF2FC',color:archived?'#9E9890':'#2B5EA7',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,flexShrink:0}}>
            {nom[0]}{nom.split(' ')?.[1]?.[0]||''}
          </div>
          <div>
            <div style={{fontWeight:600,fontSize:14}}>{nom}</div>
            <div style={{fontSize:12,color:'#6B6560'}}>
              {loc.biens?.adresse} · {Number(loc.loyer_mensuel||0).toLocaleString('fr-FR')} €/mois HC
              {loc.charges>0?` + ${Number(loc.charges).toLocaleString('fr-FR')} € ch.`:''}
              {loc.date_debut?` · entrée ${new Date(loc.date_debut).toLocaleDateString('fr-FR')}`:''}
            </div>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
          <span className={`status ${loc.statut==='actif'?'status-green':'status-grey'}`}>{loc.statut}</span>
          {typeLabel&&<span className="status status-blue" style={{fontSize:10}}>{typeLabel}</span>}
          {isCourte&&loc.plateforme&&<span className="status status-yellow" style={{fontSize:10}}>📱 {loc.plateforme}</span>}
          <span style={{color:'#9E9890'}}>{isExp?'▲':'▼'}</span>
        </div>
      </div>

      {isExp&&<div className="card-body">
        {/* Infos principales */}
        {p&&<div style={{fontSize:13,marginBottom:12,display:'flex',gap:14,flexWrap:'wrap',background:'#F7F5F0',padding:'8px 12px',borderRadius:8}}>
          {p.telephone&&<span>📞 {p.telephone}</span>}
          {p.email&&<span>✉️ {p.email}</span>}
        </div>}

        {/* Dépôt de garantie */}
        {loc.depot_garantie>0&&<div style={{marginBottom:12,background:'#FDF3E7',borderRadius:8,padding:'10px 14px'}}>
          <div style={{fontSize:11,fontWeight:700,color:'#C8813A',textTransform:'uppercase',marginBottom:6}}>🔐 Dépôt de garantie</div>
          <div style={{display:'flex',gap:16,flexWrap:'wrap',fontSize:13}}>
            <span>Montant : <strong>{Number(loc.depot_garantie).toLocaleString('fr-FR')} €</strong></span>
            <span style={{color:loc.depot_verse?'#2D5A3D':'#B83232'}}>{loc.depot_verse?`✅ Versé le ${new Date(loc.depot_verse_date||'').toLocaleDateString('fr-FR')} · ${loc.depot_verse_moyen||''}${loc.depot_verse_ref?` · réf: ${loc.depot_verse_ref}`:''}`:'❌ Non versé'}</span>
            {loc.depot_rendu&&<span style={{color:'#6B6560'}}>↩️ Rendu le {new Date(loc.depot_rendu_date||'').toLocaleDateString('fr-FR')}{loc.depot_rendu_montant?` · ${Number(loc.depot_rendu_montant).toLocaleString('fr-FR')} €`:''}</span>}
          </div>
          {!loc.statut==='actif'&&!loc.depot_rendu&&<button className="btn btn-secondary btn-sm" style={{marginTop:6}} onClick={()=>setShowDepot(!showDepot)}>{showDepot?'Fermer':'Marquer comme rendu'}</button>}
          {showDepot&&<div className="grid2" style={{marginTop:8}}>
            <div className="fld"><label>Date de restitution</label><input type="date" value={depotForm.date||''} onChange={e=>setDepotForm(f=>({...f,date:e.target.value}))}/></div>
            <div className="fld"><label>Montant rendu (€)</label><input type="number" value={depotForm.montant||''} onChange={e=>setDepotForm(f=>({...f,montant:e.target.value}))}/></div>
            <div className="fld"><label>Moyen</label><select value={depotForm.moyen||''} onChange={e=>setDepotForm(f=>({...f,moyen:e.target.value}))}><option value="">—</option>{['Virement bancaire','Chèque','Espèces','Autre'].map(m=><option key={m}>{m}</option>)}</select></div>
            <div style={{display:'flex',alignItems:'flex-end'}}><button className="btn btn-primary btn-sm" onClick={()=>updateDepot(loc.id,{depot_rendu:true,depot_rendu_date:depotForm.date,depot_rendu_montant:depotForm.montant?Number(depotForm.montant):null,depot_rendu_moyen:depotForm.moyen})}>Confirmer</button></div>
          </div>}
        </div>}

        {/* Occupants */}
        {(loc.occupants||[]).length>0&&<div style={{marginBottom:10}}>
          <div style={{fontSize:10,fontWeight:700,color:'#9E9890',textTransform:'uppercase',marginBottom:5}}>👥 Occupants</div>
          {loc.occupants.map(o=><div key={o.id} style={{display:'flex',justifyContent:'space-between',padding:'3px 0',borderBottom:'1px solid rgba(0,0,0,.04)',fontSize:13}}>
            <span>{o.prenom} {o.nom} <span style={{color:'#9E9890',fontSize:11}}>({o.lien}){o.date_naissance?` · ${new Date().getFullYear()-new Date(o.date_naissance).getFullYear()} ans`:''}</span></span>
            <button onClick={()=>delOccupant(o.id)} style={{background:'none',border:'none',cursor:'pointer',color:'#B83232',fontSize:13}}>✕</button>
          </div>)}
        </div>}

        {/* Cautions */}
        {(loc.cautions||[]).length>0&&<div style={{marginBottom:10}}>
          <div style={{fontSize:10,fontWeight:700,color:'#9E9890',textTransform:'uppercase',marginBottom:5}}>🛡️ Cautions / Garants ({loc.cautions.length})</div>
          {loc.cautions.map(c=><div key={c.id} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:'1px solid rgba(0,0,0,.04)'}}>
            <div>
              <span style={{fontSize:13,fontWeight:500}}>{c.prenom?`${c.prenom} ${c.nom}`:c.nom}</span>
              <span style={{color:'#9E9890',fontSize:11,marginLeft:6}}>
                {c.type_caution}{c.lien_locataire?` · ${c.lien_locataire}`:''}
                {c.montant_garanti?` · ${Number(c.montant_garanti).toLocaleString('fr-FR')} €`:''}
                {c.telephone?` · ${c.telephone}`:''}
                {c.revenu_mensuel?` · ${Number(c.revenu_mensuel).toLocaleString('fr-FR')} €/mois`:''}
              </span>
            </div>
            <button onClick={()=>delCaution(c.id)} style={{background:'none',border:'none',cursor:'pointer',color:'#B83232',fontSize:13}}>✕</button>
          </div>)}
        </div>}

        {/* Index compteurs */}
        {(loc.index_entree_elec||loc.index_entree_eau||loc.index_entree_gaz)&&<div style={{marginBottom:10,background:'#F7F5F0',borderRadius:8,padding:'8px 12px'}}>
          <div style={{fontSize:10,fontWeight:700,color:'#9E9890',textTransform:'uppercase',marginBottom:5}}>📊 Relevés compteurs — Entrée</div>
          <div style={{display:'flex',gap:12,fontSize:12,flexWrap:'wrap'}}>
            {loc.index_entree_eau&&<span>💧 {loc.index_entree_eau} m³</span>}
            {loc.index_entree_elec&&<span>⚡ {loc.index_entree_elec} kWh</span>}
            {loc.index_entree_gaz&&<span>🔥 {loc.index_entree_gaz} m³</span>}
          </div>
        </div>}

        {/* Actions */}
        <div style={{display:'flex',gap:8,flexWrap:'wrap',paddingTop:8,borderTop:'1px solid rgba(0,0,0,.07)'}}>
          {!archived&&<>
            <button className="btn btn-secondary btn-sm" onClick={()=>{setFormErr('');setForm({});setModal({type:'occupant',locationId:loc.id})}}>+ Occupant</button>
            <button className="btn btn-secondary btn-sm" onClick={()=>{setFormErr('');setForm({c_type:'physique'});setModal({type:'caution',locationId:loc.id})}}>+ Caution / Garant</button>
            <button className="btn btn-danger btn-sm" onClick={()=>archiver(loc.id)}>📦 Archiver</button>
          </>}
          <button className="btn btn-danger btn-sm" onClick={()=>supprimer(loc.id)}>🗑️ Supprimer</button>
        </div>
      </div>}
    </div>
  )
}
