// src/pages/Locataires.jsx — Gestion des locataires
import React, { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const CONTRATS = [
  { value:'bail_vide',      label:'Bail vide (non meublé)' },
  { value:'bail_meuble',    label:'Bail meublé' },
  { value:'bail_commercial',label:'Bail commercial' },
  { value:'courte_duree',   label:'Courte durée / Airbnb' },
  { value:'colocation',     label:'Colocation' },
  { value:'saisonnier',     label:'Saisonnier' },
  { value:'autre',          label:'Autre' },
]
const LIENS_GARANT = ['parent','ami','organisme','employeur','conjoint','autre']
const TYPES_CAUTION = [
  { value:'physique', label:'Personne physique' },
  { value:'morale',   label:'Personne morale (société)' },
  { value:'visale',   label:'Visale / Action Logement' },
  { value:'bancaire', label:'Caution bancaire' },
]

export default function Locataires() {
  const { session } = useAuth()
  const [locataires, setLocataires] = useState([])
  const [biens, setBiens]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [modal, setModal]           = useState(null) // 'create' | 'garant' | 'occupant'
  const [selLoc, setSelLoc]         = useState(null)
  const [form, setForm]             = useState({})
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')
  const [expanded, setExpanded]     = useState(null)

  const load = useCallback(async () => {
    if (!session) return
    setLoading(true)
    const [locsRes, biensRes] = await Promise.all([
      supabase.from('locations').select(`
        *,
        bien:biens(id, adresse, ville, type_bien),
        locataire:profiles(id, nom, prenom, telephone, telephone2, email, notes),
        garants(*),
        occupants(*)
      `).order('created_at', { ascending: false }),
      supabase.from('biens').select('id, adresse, ville')
        .eq('proprietaire_id', session.user.id)
    ])
    // Filtrer les locations liées aux biens du proprio
    const myBienIds = (biensRes.data||[]).map(b => b.id)
    const myLocs = (locsRes.data||[]).filter(l => myBienIds.includes(l.bien_id))
    setLocataires(myLocs)
    setBiens(biensRes.data||[])
    setLoading(false)
  }, [session])

  useEffect(() => { load() }, [load])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function openCreate() {
    setForm({ role:'locataire', type_contrat:'bail_vide', colocation:false })
    setError('')
    setModal('create')
  }

  // ── Créer locataire + location ──────────────────────────
  async function saveLocataire() {
    if (!form.nom || !form.prenom || !form.bien_id || !form.loyer || !form.date_debut) {
      setError('Nom, prénom, bien, loyer et date d\'entrée sont obligatoires.'); return
    }
    setSaving(true); setError('')
    try {
      // 1. Chercher si un profil Auth existe déjà pour cet email
      let profileId = form.user_id || null

      if (!profileId && form.email) {
        const { data: existingProfiles } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', form.user_id || '00000000-0000-0000-0000-000000000000')
          .maybeSingle()
        // On ne peut pas chercher par email sans service_role
        // On crée une invitation à la place
      }

      // 2. Créer la location (avec ou sans locataire lié)
      const { data: loc, error: locErr } = await supabase
        .from('locations')
        .insert({
          bien_id:       form.bien_id,
          locataire_id:  profileId,
          loyer_mensuel: Number(form.loyer),
          date_debut:    form.date_debut,
          date_fin:      form.date_fin || null,
          statut:        'actif',
        })
        .select()
        .single()
      if (locErr) throw locErr

      // 3. Si pas de compte Auth, créer une invitation
      if (!profileId) {
        await supabase.from('invitations').insert({
          email:        (form.email||'').toLowerCase().trim() || `locataire-${loc.id}@placeholder.com`,
          role:         'locataire',
          nom:          form.nom,
          prenom:       form.prenom,
          telephone:    form.telephone || null,
          bien_id:      form.bien_id,
          loyer:        Number(form.loyer),
          date_debut:   form.date_debut,
          type_contrat: form.type_contrat || null,
          cree_par:     session.user.id,
        })
      }

      // 4. Détails du contrat
      await supabase.from('locataire_details').upsert({
        profile_id:    profileId,
        type_contrat:  form.type_contrat || null,
        meuble:        form.meuble === true || form.meuble === 'true',
        colocation:    form.colocation === true || form.colocation === 'true',
        nb_colocataires: Number(form.nb_colocataires) || 1,
        date_entree:   form.date_debut,
        date_sortie:   form.date_fin || null,
        loyer_hc:      Number(form.loyer),
        charges:       Number(form.charges) || 0,
        depot_garantie:Number(form.depot) || 0,
        situation_pro: form.situation_pro || null,
        employeur:     form.employeur || null,
      }).eq('profile_id', profileId || '00000000-0000-0000-0000-000000000000')
        .throwOnError()
        .catch(() => {}) // Ignore si profile_id null

      // 5. Ajouter occupant principal
      await supabase.from('occupants').insert({
        location_id:    loc.id,
        nom:            form.nom,
        prenom:         form.prenom,
        date_naissance: form.date_naissance || null,
        lien:           'titulaire',
      })

      setModal(null)
      await load()
    } catch(e) {
      setError(e.message || 'Erreur lors de la création')
    } finally {
      setSaving(false)
    }
  }

  // ── Ajouter garant ──────────────────────────────────────
  async function saveGarant() {
    if (!form.g_nom || !form.g_prenom) { setError('Nom et prénom obligatoires'); return }
    setSaving(true); setError('')
    try {
      await supabase.from('garants').insert({
        location_id:  selLoc.id,
        nom:          form.g_nom,
        prenom:       form.g_prenom,
        telephone:    form.g_tel || null,
        email:        form.g_email || null,
        adresse:      form.g_adresse || null,
        lien:         form.g_lien || 'autre',
        type_caution: form.g_type || 'physique',
        montant:      form.g_montant ? Number(form.g_montant) : null,
        date_debut:   form.g_date || null,
        notes:        form.g_notes || null,
      })
      setModal(null); await load()
    } catch(e) { setError(e.message) }
    finally { setSaving(false) }
  }

  // ── Ajouter occupant ────────────────────────────────────
  async function saveOccupant() {
    if (!form.o_nom || !form.o_prenom) { setError('Nom et prénom obligatoires'); return }
    setSaving(true); setError('')
    try {
      await supabase.from('occupants').insert({
        location_id:    selLoc.id,
        nom:            form.o_nom,
        prenom:         form.o_prenom,
        date_naissance: form.o_dob || null,
        lien:           form.o_lien || 'autre',
      })
      setModal(null); await load()
    } catch(e) { setError(e.message) }
    finally { setSaving(false) }
  }

  async function deleteGarant(id) {
    if (!window.confirm('Supprimer ce garant ?')) return
    await supabase.from('garants').delete().eq('id', id)
    await load()
  }

  async function deleteOccupant(id) {
    if (!window.confirm('Supprimer cet occupant ?')) return
    await supabase.from('occupants').delete().eq('id', id)
    await load()
  }

  async function terminateLocation(id) {
    if (!window.confirm('Marquer cette location comme terminée ?')) return
    await supabase.from('locations').update({ statut:'termine', date_fin: new Date().toISOString().split('T')[0] }).eq('id', id)
    await load()
  }

  if (loading) return <Layout><div style={css.center}><div style={css.spinner}/></div></Layout>

  return (
    <Layout>
      <div style={css.header}>
        <div>
          <h1 style={css.h1}>Locataires</h1>
          <p style={css.sub}>{locataires.filter(l=>l.statut==='actif').length} location(s) active(s)</p>
        </div>
        <button style={css.btnPrimary} onClick={openCreate}>+ Ajouter un locataire</button>
      </div>

      {locataires.length === 0 && (
        <div style={css.emptyCard}>
          <div style={{ fontSize:48 }}>👤</div>
          <h2 style={css.emptyTitle}>Aucun locataire</h2>
          <p style={css.emptySub}>Créez votre premier locataire et associez-le à un bien.</p>
          <button style={css.btnPrimary} onClick={openCreate}>+ Ajouter un locataire</button>
        </div>
      )}

      {locataires.map(loc => {
        const isExp = expanded === loc.id
        const locataire = loc.locataire
        return (
          <div key={loc.id} style={css.locCard}>
            {/* En-tête */}
            <div style={css.locHeader} onClick={() => setExpanded(isExp ? null : loc.id)}>
              <div style={css.locAvatar}>
                {locataire?.prenom?.[0]||'?'}{locataire?.nom?.[0]||'?'}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:600, fontSize:14 }}>
                  {locataire ? `${locataire.prenom} ${locataire.nom}` : '⚠️ Compte non créé — invitation envoyée'}
                </div>
                <div style={{ fontSize:12, color:'#6B6560', marginTop:2 }}>
                  {loc.bien?.adresse}, {loc.bien?.ville}
                  {' · '}{Number(loc.loyer_mensuel).toLocaleString('fr-FR')} €/mois
                  {' · '}depuis le {new Date(loc.date_debut).toLocaleDateString('fr-FR')}
                </div>
              </div>
              <span style={{ ...css.badge,
                background: loc.statut==='actif'?'#E8F2EB':'#F7F5F0',
                color: loc.statut==='actif'?'#2D5A3D':'#9E9890' }}>
                {loc.statut}
              </span>
              <span style={{ color:'#9E9890', fontSize:18, marginLeft:8 }}>{isExp?'▲':'▼'}</span>
            </div>

            {/* Détails expandables */}
            {isExp && (
              <div style={css.locBody}>
                {/* Infos locataire */}
                {locataire && (
                  <Section title="👤 Coordonnées">
                    <Grid2>
                      <Info label="Téléphone" val={locataire.telephone||'—'} />
                      <Info label="Téléphone 2" val={locataire.telephone2||'—'} />
                    </Grid2>
                    {locataire.notes && <Info label="Notes" val={locataire.notes} />}
                  </Section>
                )}

                {/* Contrat */}
                <Section title="📋 Contrat">
                  <Grid2>
                    <Info label="Date d'entrée" val={new Date(loc.date_debut).toLocaleDateString('fr-FR')} />
                    <Info label="Date de sortie" val={loc.date_fin ? new Date(loc.date_fin).toLocaleDateString('fr-FR') : 'Indéterminée'} />
                    <Info label="Loyer HC" val={`${Number(loc.loyer_mensuel).toLocaleString('fr-FR')} €`} />
                  </Grid2>
                </Section>

                {/* Occupants */}
                <Section title={`👥 Occupants (${loc.occupants?.length||0})`}
                  action={<button style={css.btnXs} onClick={() => { setSelLoc(loc); setForm({}); setError(''); setModal('occupant') }}>+ Ajouter</button>}>
                  {(loc.occupants||[]).map(o => (
                    <div key={o.id} style={css.miniRow}>
                      <span style={{ fontSize:13 }}>
                        {o.prenom} {o.nom}
                        {o.date_naissance && ` · ${new Date().getFullYear() - new Date(o.date_naissance).getFullYear()} ans`}
                        <span style={{ color:'#9E9890', marginLeft:6 }}>({o.lien})</span>
                      </span>
                      <button style={css.delBtn} onClick={() => deleteOccupant(o.id)}>✕</button>
                    </div>
                  ))}
                  {(loc.occupants||[]).length===0 && <div style={css.empty2}>Aucun occupant</div>}
                </Section>

                {/* Garants */}
                <Section title={`🛡️ Garants / Cautions (${loc.garants?.length||0})`}
                  action={<button style={css.btnXs} onClick={() => { setSelLoc(loc); setForm({}); setError(''); setModal('garant') }}>+ Ajouter</button>}>
                  {(loc.garants||[]).map(g => (
                    <div key={g.id} style={css.miniRow}>
                      <div>
                        <div style={{ fontSize:13, fontWeight:500 }}>{g.prenom} {g.nom} <span style={{ color:'#9E9890', fontWeight:400 }}>({g.lien})</span></div>
                        <div style={{ fontSize:12, color:'#6B6560' }}>
                          {g.type_caution}{g.montant ? ` · ${Number(g.montant).toLocaleString('fr-FR')} €` : ''}
                          {g.telephone ? ` · ${g.telephone}` : ''}
                        </div>
                      </div>
                      <button style={css.delBtn} onClick={() => deleteGarant(g.id)}>✕</button>
                    </div>
                  ))}
                  {(loc.garants||[]).length===0 && <div style={css.empty2}>Aucun garant</div>}
                </Section>

                {/* Actions */}
                <div style={{ display:'flex', gap:8, marginTop:8, paddingTop:12, borderTop:'1px solid rgba(0,0,0,0.07)' }}>
                  {loc.statut==='actif' && (
                    <button style={css.btnSmDanger} onClick={() => terminateLocation(loc.id)}>
                      🔚 Terminer la location
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* ══ MODALS ══ */}
      {modal && (
        <div style={css.overlay} onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div style={css.modalWrap}>
            <div style={css.modalHeader}>
              <span style={css.modalTitle}>
                {modal==='create' ? '👤 Nouveau locataire'
                  : modal==='garant' ? '🛡️ Ajouter un garant'
                  : '👥 Ajouter un occupant'}
              </span>
              <button style={css.closeBtn} onClick={()=>setModal(null)}>✕</button>
            </div>
            <div style={{ padding:'18px 22px', overflowY:'auto', maxHeight:'72vh', display:'flex', flexDirection:'column', gap:12 }}>
              {error && <div style={css.errBox}>{error}</div>}

              {modal==='create' && <>
                <SLabel>👤 Identité</SLabel>
                <Row2>
                  <Fld label="Prénom *" val={form.prenom||''} set={v=>set('prenom',v)} />
                  <Fld label="Nom *" val={form.nom||''} set={v=>set('nom',v)} />
                </Row2>
                <Row2>
                  <Fld label="Email" val={form.email||''} set={v=>set('email',v)} type="email" />
                  <Fld label="Téléphone" val={form.telephone||''} set={v=>set('telephone',v)} />
                </Row2>
                <Fld label="UUID Auth (si compte déjà créé)" val={form.user_id||''} set={v=>set('user_id',v)} placeholder="Laisser vide si pas encore de compte" />

                <SLabel>🏠 Bien & Contrat</SLabel>
                <Sel label="Bien concerné *" val={form.bien_id||''} set={v=>set('bien_id',v)}
                  opts={[{v:'',l:'— Choisir un bien —'}, ...biens.map(b=>({v:b.id,l:`${b.adresse}, ${b.ville}`}))]} />
                <Sel label="Type de contrat" val={form.type_contrat||''} set={v=>set('type_contrat',v)}
                  opts={[{v:'',l:'— Choisir —'}, ...CONTRATS.map(c=>({v:c.value,l:c.label}))]} />
                <Row2>
                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    <label style={css.lbl}>Meublé</label>
                    <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13 }}>
                      <input type="checkbox" checked={form.meuble||false} onChange={e=>set('meuble',e.target.checked)} />
                      Logement meublé
                    </label>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    <label style={css.lbl}>Colocation</label>
                    <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13 }}>
                      <input type="checkbox" checked={form.colocation||false} onChange={e=>set('colocation',e.target.checked)} />
                      En colocation
                    </label>
                  </div>
                </Row2>
                <SLabel>💶 Financier</SLabel>
                <Row2>
                  <Fld label="Loyer HC (€) *" val={form.loyer||''} set={v=>set('loyer',v)} type="number" />
                  <Fld label="Charges (€)" val={form.charges||''} set={v=>set('charges',v)} type="number" />
                </Row2>
                <Row2>
                  <Fld label="Dépôt de garantie (€)" val={form.depot||''} set={v=>set('depot',v)} type="number" />
                  <Fld label="Durée bail (mois)" val={form.duree||''} set={v=>set('duree',v)} type="number" />
                </Row2>
                <SLabel>📅 Dates</SLabel>
                <Row2>
                  <Fld label="Date d'entrée *" val={form.date_debut||''} set={v=>set('date_debut',v)} type="date" />
                  <Fld label="Date de sortie prévue" val={form.date_fin||''} set={v=>set('date_fin',v)} type="date" />
                </Row2>
                <button style={{ ...css.btnPrimary, opacity:saving?.7:1 }} onClick={saveLocataire} disabled={saving}>
                  {saving ? 'Création en cours…' : '✅ Créer le locataire'}
                </button>
              </>}

              {modal==='garant' && <>
                <SLabel>👤 Identité</SLabel>
                <Row2>
                  <Fld label="Prénom *" val={form.g_prenom||''} set={v=>set('g_prenom',v)} />
                  <Fld label="Nom *" val={form.g_nom||''} set={v=>set('g_nom',v)} />
                </Row2>
                <Row2>
                  <Fld label="Téléphone" val={form.g_tel||''} set={v=>set('g_tel',v)} />
                  <Fld label="Email" val={form.g_email||''} set={v=>set('g_email',v)} type="email" />
                </Row2>
                <Fld label="Adresse" val={form.g_adresse||''} set={v=>set('g_adresse',v)} />
                <SLabel>🛡️ Caution</SLabel>
                <Sel label="Lien avec le locataire" val={form.g_lien||'autre'} set={v=>set('g_lien',v)}
                  opts={LIENS_GARANT.map(l=>({v:l,l:l.charAt(0).toUpperCase()+l.slice(1)}))} />
                <Sel label="Type de caution" val={form.g_type||'physique'} set={v=>set('g_type',v)}
                  opts={TYPES_CAUTION.map(t=>({v:t.value,l:t.label}))} />
                <Row2>
                  <Fld label="Montant garanti (€)" val={form.g_montant||''} set={v=>set('g_montant',v)} type="number" />
                  <Fld label="Date de début" val={form.g_date||''} set={v=>set('g_date',v)} type="date" />
                </Row2>
                <Fld label="Notes" val={form.g_notes||''} set={v=>set('g_notes',v)} multiline />
                <button style={css.btnPrimary} onClick={saveGarant} disabled={saving}>
                  {saving?'Enregistrement…':'🛡️ Ajouter le garant'}
                </button>
              </>}

              {modal==='occupant' && <>
                <Row2>
                  <Fld label="Prénom *" val={form.o_prenom||''} set={v=>set('o_prenom',v)} />
                  <Fld label="Nom *" val={form.o_nom||''} set={v=>set('o_nom',v)} />
                </Row2>
                <Row2>
                  <Fld label="Date de naissance" val={form.o_dob||''} set={v=>set('o_dob',v)} type="date" />
                  <Sel label="Lien avec le titulaire" val={form.o_lien||'autre'} set={v=>set('o_lien',v)}
                    opts={['titulaire','conjoint','enfant','colocataire','autre'].map(l=>({v:l,l:l.charAt(0).toUpperCase()+l.slice(1)}))} />
                </Row2>
                <button style={css.btnPrimary} onClick={saveOccupant} disabled={saving}>
                  {saving?'Enregistrement…':'+ Ajouter l\'occupant'}
                </button>
              </>}
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

// ── Helpers UI ───────────────────────────────────────────
function Section({ title, children, action }) {
  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
        <div style={{ fontSize:11, fontWeight:700, color:'#6B6560', textTransform:'uppercase', letterSpacing:'.05em' }}>{title}</div>
        {action}
      </div>
      {children}
    </div>
  )
}
function Info({ label, val }) {
  return (
    <div style={{ marginBottom:6 }}>
      <div style={{ fontSize:10, color:'#9E9890', textTransform:'uppercase', letterSpacing:'.04em' }}>{label}</div>
      <div style={{ fontSize:13, color:'#1A1714', fontWeight:500 }}>{val}</div>
    </div>
  )
}
function Grid2({ children }) { return <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>{children}</div> }
function SLabel({ children }) { return <div style={{ fontSize:10, fontWeight:700, color:'#6B6560', textTransform:'uppercase', letterSpacing:'.06em', marginTop:4 }}>{children}</div> }
function Row2({ children }) { return <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>{children}</div> }
function Fld({ label, val, set, type='text', placeholder, multiline }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:4, flex:1 }}>
      <label style={css.lbl}>{label}</label>
      {multiline
        ? <textarea style={{ ...css.inp, minHeight:64, resize:'vertical' }} value={val} placeholder={placeholder} onChange={e=>set(e.target.value)} />
        : <input style={css.inp} type={type} value={val} placeholder={placeholder} onChange={e=>set(e.target.value)} />
      }
    </div>
  )
}
function Sel({ label, val, set, opts }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:4, flex:1 }}>
      <label style={css.lbl}>{label}</label>
      <select style={css.inp} value={val} onChange={e=>set(e.target.value)}>
        {opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  )
}

const css = {
  center:      { display:'flex', alignItems:'center', justifyContent:'center', minHeight:300 },
  spinner:     { width:32, height:32, borderRadius:'50%', border:'3px solid #E8F2EB', borderTopColor:'#2D5A3D', animation:'spin 0.8s linear infinite' },
  header:      { display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20, gap:16, flexWrap:'wrap' },
  h1:          { fontFamily:'Georgia,serif', fontSize:24, fontWeight:500, color:'#1A1714', margin:0 },
  sub:         { fontSize:13, color:'#6B6560', margin:'4px 0 0' },
  emptyCard:   { background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:'40px 24px', display:'flex', flexDirection:'column', alignItems:'center', gap:14, textAlign:'center' },
  emptyTitle:  { fontFamily:'Georgia,serif', fontSize:18, fontWeight:500, margin:0 },
  emptySub:    { fontSize:13, color:'#6B6560', margin:0 },
  locCard:     { background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:12, overflow:'hidden', marginBottom:12 },
  locHeader:   { display:'flex', alignItems:'center', gap:12, padding:'14px 18px', cursor:'pointer', flexWrap:'wrap' },
  locAvatar:   { width:38, height:38, borderRadius:'50%', background:'#EBF2FC', color:'#2B5EA7', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, flexShrink:0 },
  locBody:     { padding:'0 18px 16px', borderTop:'1px solid rgba(0,0,0,0.07)' },
  badge:       { padding:'3px 9px', borderRadius:20, fontSize:11, fontWeight:600, flexShrink:0 },
  miniRow:     { display:'flex', alignItems:'flex-start', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid rgba(0,0,0,0.05)' },
  empty2:      { fontSize:12, color:'#9E9890', padding:'6px 0' },
  delBtn:      { background:'none', border:'none', cursor:'pointer', color:'#B83232', fontSize:14, padding:'2px 6px', flexShrink:0 },
  overlay:     { position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 },
  modalWrap:   { background:'#fff', borderRadius:14, width:'100%', maxWidth:520, boxShadow:'0 8px 32px rgba(0,0,0,0.15)', display:'flex', flexDirection:'column', maxHeight:'90vh' },
  modalHeader: { padding:'16px 22px 12px', borderBottom:'1px solid rgba(0,0,0,0.08)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 },
  modalTitle:  { fontFamily:'Georgia,serif', fontSize:16, fontWeight:500 },
  closeBtn:    { width:26, height:26, border:'1px solid rgba(0,0,0,0.12)', borderRadius:5, background:'none', cursor:'pointer', fontSize:13 },
  lbl:         { fontSize:10, fontWeight:600, color:'#6B6560', textTransform:'uppercase', letterSpacing:'.05em' },
  inp:         { padding:'8px 11px', border:'1px solid rgba(0,0,0,0.15)', borderRadius:7, fontFamily:'inherit', fontSize:13.5, outline:'none', width:'100%', boxSizing:'border-box' },
  errBox:      { background:'#FDEAEA', color:'#B83232', borderRadius:7, padding:'9px 12px', fontSize:12 },
  btnPrimary:  { padding:'10px', background:'#2D5A3D', color:'#fff', border:'none', borderRadius:8, fontFamily:'inherit', fontSize:13, fontWeight:500, cursor:'pointer' },
  btnXs:       { padding:'3px 10px', background:'#fff', color:'#2D5A3D', border:'1px solid #2D5A3D', borderRadius:6, fontFamily:'inherit', fontSize:11, cursor:'pointer' },
  btnSmDanger: { padding:'7px 14px', background:'#FDEAEA', color:'#B83232', border:'1px solid rgba(184,50,50,0.2)', borderRadius:7, fontFamily:'inherit', fontSize:12, cursor:'pointer' },
}
