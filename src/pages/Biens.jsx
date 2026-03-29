// src/pages/Biens.jsx
import React, { useEffect, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

export default function Biens() {
  const { session } = useAuth()
  const [biens, setBiens]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(null) // null | 'bien' | 'locataire' | 'piece'
  const [selected, setSelected] = useState(null) // bien sélectionné
  const [form, setForm]         = useState({})
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => { load() }, [session])

  async function load() {
    if (!session) return
    setLoading(true)
    const { data } = await supabase
      .from('biens')
      .select(`
        *,
        locations(
          id, loyer_mensuel, date_debut, date_fin, statut,
          locataire:profiles(id, nom, prenom, telephone)
        ),
        pieces(id, nom, ordre, elements(id, nom, type))
      `)
      .eq('proprietaire_id', session.user.id)
      .order('created_at', { ascending: false })
    setBiens(data || [])
    setLoading(false)
  }

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function openModal(type, bien = null) {
    setSelected(bien)
    setForm({})
    setError('')
    setModal(type)
  }

  async function saveBien() {
    if (!form.adresse || !form.ville || !form.type_bien) {
      setError('Adresse, ville et type sont obligatoires.'); return
    }
    setSaving(true); setError('')
    try {
      if (selected) {
        await supabase.from('biens').update({
          adresse: form.adresse, ville: form.ville,
          code_postal: form.code_postal || '',
          type_bien: form.type_bien, surface_m2: form.surface_m2 || null
        }).eq('id', selected.id)
      } else {
        await supabase.from('biens').insert({
          proprietaire_id: session.user.id,
          adresse: form.adresse, ville: form.ville,
          code_postal: form.code_postal || '',
          type_bien: form.type_bien, surface_m2: form.surface_m2 || null
        })
      }
      setModal(null); await load()
    } catch(e) { setError(e.message) }
    finally { setSaving(false) }
  }

  async function deleteBien(id) {
    if (!window.confirm('Supprimer ce bien et toutes ses données ?')) return
    await supabase.from('biens').delete().eq('id', id)
    await load()
  }

  async function saveLocation() {
    if (!form.loyer || !form.date_debut) {
      setError('Loyer et date de début obligatoires.'); return
    }
    setSaving(true); setError('')
    try {
      // Chercher le locataire par email
      let locataireId = null
      if (form.locataire_email) {
        const { data: u } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', (await supabase.auth.admin?.getUserByEmail?.(form.locataire_email))?.data?.user?.id || '00000000-0000-0000-0000-000000000000')
          .single()
        // Alternative : chercher dans profiles via une vue ou function
        const { data: byEmail } = await supabase
          .rpc('get_user_id_by_email', { email: form.locataire_email })
          .single()
        locataireId = byEmail || null
      }

      // Désactiver les locations actives existantes
      await supabase.from('locations')
        .update({ statut: 'termine' })
        .eq('bien_id', selected.id)
        .eq('statut', 'actif')

      await supabase.from('locations').insert({
        bien_id: selected.id,
        locataire_id: locataireId,
        loyer_mensuel: Number(form.loyer),
        date_debut: form.date_debut,
        date_fin: form.date_fin || null,
        statut: 'actif'
      })
      setModal(null); await load()
    } catch(e) { setError(e.message) }
    finally { setSaving(false) }
  }

  async function savePiece() {
    if (!form.nom) { setError('Nom obligatoire.'); return }
    setSaving(true); setError('')
    try {
      await supabase.from('pieces').insert({
        bien_id: selected.id, nom: form.nom, ordre: Number(form.ordre) || 0
      })
      setModal(null); await load()
    } catch(e) { setError(e.message) }
    finally { setSaving(false) }
  }

  async function saveElement(pieceId) {
    if (!form.nom_el) { setError('Nom obligatoire.'); return }
    setSaving(true); setError('')
    try {
      await supabase.from('elements').insert({
        piece_id: pieceId, nom: form.nom_el, type: form.type_el || 'autre'
      })
      setModal(null); await load()
    } catch(e) { setError(e.message) }
    finally { setSaving(false) }
  }

  async function deletePiece(id) {
    if (!window.confirm('Supprimer cette pièce et ses éléments ?')) return
    await supabase.from('pieces').delete().eq('id', id)
    await load()
  }

  if (loading) return <Layout><div style={css.center}><div style={css.spinner}/></div></Layout>

  return (
    <Layout>
      <div style={css.header}>
        <div>
          <h1 style={css.h1}>Mes biens</h1>
          <p style={css.sub}>{biens.length} bien(s) enregistré(s)</p>
        </div>
        <button style={css.btnPrimary} onClick={() => openModal('bien')}>
          + Ajouter un bien
        </button>
      </div>

      {biens.length === 0 && (
        <div style={css.emptyCard}>
          <div style={{ fontSize: 48 }}>🏢</div>
          <h2 style={css.emptyTitle}>Aucun bien enregistré</h2>
          <p style={css.emptySub}>Commencez par ajouter votre premier bien immobilier.</p>
          <button style={css.btnPrimary} onClick={() => openModal('bien')}>+ Ajouter un bien</button>
        </div>
      )}

      {biens.map(b => {
        const locActive = b.locations?.find(l => l.statut === 'actif')
        return (
          <div key={b.id} style={css.bienCard}>
            {/* En-tête bien */}
            <div style={css.bienHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={css.bienIcon}>🏠</div>
                <div>
                  <div style={css.bienAddr}>{b.adresse}, {b.ville} {b.code_postal}</div>
                  <div style={css.bienMeta}>{b.type_bien}{b.surface_m2 ? ` · ${b.surface_m2} m²` : ''}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={{...css.btnSm, color:'#2B5EA7', borderColor:'#2B5EA7'}} onClick={() => window.location.href='/biens/'+b.id+'/plan'}>🗺️ Plan</button>
                <button style={css.btnSm} onClick={() => { openModal('bien', b); setForm({ adresse: b.adresse, ville: b.ville, code_postal: b.code_postal, type_bien: b.type_bien, surface_m2: b.surface_m2 }) }}>✏️ Modifier</button>
                <button style={css.btnSmDanger} onClick={() => deleteBien(b.id)}>🗑️ Supprimer</button>
              </div>
            </div>

            <div style={css.bienBody}>
              {/* LOCATAIRE */}
              <div style={css.section}>
                <div style={css.sectionTitle}>👤 Locataire</div>
                {locActive ? (
                  <div style={css.locCard}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>
                        {locActive.locataire
                          ? `${locActive.locataire.prenom} ${locActive.locataire.nom}`
                          : <span style={{ color: '#9E9890' }}>Compte non créé</span>
                        }
                      </div>
                      {locActive.locataire?.telephone && (
                        <div style={{ fontSize: 12, color: '#6B6560' }}>{locActive.locataire.telephone}</div>
                      )}
                      <div style={{ fontSize: 12, color: '#6B6560', marginTop: 2 }}>
                        {Number(locActive.loyer_mensuel).toLocaleString('fr-FR')} €/mois
                        · depuis le {new Date(locActive.date_debut).toLocaleDateString('fr-FR')}
                        {locActive.date_fin ? ` · jusqu'au ${new Date(locActive.date_fin).toLocaleDateString('fr-FR')}` : ''}
                      </div>
                    </div>
                    <span style={css.badgeGreen}>Actif</span>
                  </div>
                ) : (
                  <div style={css.locEmpty}>
                    Aucun locataire associé
                    <button style={css.btnXs} onClick={() => openModal('locataire', b)}>+ Associer</button>
                  </div>
                )}
                <button style={{ ...css.btnXs, marginTop: 8 }} onClick={() => openModal('locataire', b)}>
                  {locActive ? '🔄 Changer de locataire' : '+ Ajouter un locataire'}
                </button>
              </div>

              {/* PIÈCES */}
              <div style={css.section}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={css.sectionTitle}>🏠 Pièces ({b.pieces?.length || 0})</div>
                  <button style={css.btnXs} onClick={() => openModal('piece', b)}>+ Pièce</button>
                </div>
                {b.pieces?.length === 0 && (
                  <div style={css.locEmpty}>Aucune pièce enregistrée</div>
                )}
                {b.pieces?.sort((a,b)=>a.ordre-b.ordre).map(p => (
                  <div key={p.id} style={css.pieceRow}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{p.nom}</span>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: '#9E9890' }}>{p.elements?.length || 0} élément(s)</span>
                      <button style={css.btnXs} onClick={() => { openModal('element', b); setSelected({ ...b, _pieceId: p.id }) }}>+ Élément</button>
                      <button style={{ ...css.btnXs, color: '#B83232', borderColor: '#B83232' }} onClick={() => deletePiece(p.id)}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })}

      {/* ── MODALS ── */}
      {modal && (
        <div style={css.overlay} onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div style={css.modal}>
            <div style={css.modalHeader}>
              <span style={css.modalTitle}>
                {modal === 'bien' ? (selected ? '✏️ Modifier le bien' : '🏢 Nouveau bien')
                  : modal === 'locataire' ? '👤 Associer un locataire'
                  : modal === 'piece' ? '🏠 Ajouter une pièce'
                  : '🔧 Ajouter un élément'}
              </span>
              <button style={css.closeBtn} onClick={() => setModal(null)}>✕</button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {error && <div style={css.errorBox}>{error}</div>}

              {modal === 'bien' && (
                <>
                  <Field label="Adresse" value={form.adresse||''} onChange={v=>set('adresse',v)} placeholder="12 rue des Acacias" required />
                  <Row>
                    <Field label="Ville" value={form.ville||''} onChange={v=>set('ville',v)} placeholder="Paris" required />
                    <Field label="Code postal" value={form.code_postal||''} onChange={v=>set('code_postal',v)} placeholder="75015" />
                  </Row>
                  <Row>
                    <SelectField label="Type de bien" value={form.type_bien||''} onChange={v=>set('type_bien',v)} required
                      options={['Appartement T1','Appartement T2','Appartement T3','Appartement T4','Maison','Studio','Autre']} />
                    <Field label="Surface (m²)" value={form.surface_m2||''} onChange={v=>set('surface_m2',v)} placeholder="68" type="number" />
                  </Row>
                  <button style={css.btnPrimary} onClick={saveBien} disabled={saving}>
                    {saving ? 'Enregistrement…' : (selected ? '💾 Mettre à jour' : '+ Créer le bien')}
                  </button>
                </>
              )}

              {modal === 'locataire' && (
                <>
                  <div style={css.infoBox}>
                    Le locataire doit d'abord créer son compte sur l'app avec le rôle "locataire".
                    Son UUID apparaîtra dans Supabase → Authentication → Users.
                  </div>
                  <Field label="UUID du locataire (Supabase Auth)" value={form.locataire_id||''}
                    onChange={v=>set('locataire_id',v)}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
                  <Row>
                    <Field label="Loyer mensuel (€)" value={form.loyer||''} onChange={v=>set('loyer',v)} type="number" required placeholder="1200" />
                    <Field label="Date de début" value={form.date_debut||''} onChange={v=>set('date_debut',v)} type="date" required />
                  </Row>
                  <Field label="Date de fin (optionnel)" value={form.date_fin||''} onChange={v=>set('date_fin',v)} type="date" />
                  <button style={css.btnPrimary} onClick={async () => {
                    if (!form.loyer || !form.date_debut) { setError('Loyer et date de début obligatoires.'); return }
                    setSaving(true); setError('')
                    try {
                      await supabase.from('locations').update({ statut: 'termine' }).eq('bien_id', selected.id).eq('statut', 'actif')
                      await supabase.from('locations').insert({
                        bien_id: selected.id,
                        locataire_id: form.locataire_id || null,
                        loyer_mensuel: Number(form.loyer),
                        date_debut: form.date_debut,
                        date_fin: form.date_fin || null,
                        statut: 'actif'
                      })
                      setModal(null); await load()
                    } catch(e) { setError(e.message) }
                    finally { setSaving(false) }
                  }} disabled={saving}>
                    {saving ? 'Enregistrement…' : '💾 Associer le locataire'}
                  </button>
                </>
              )}

              {modal === 'piece' && (
                <>
                  <Field label="Nom de la pièce" value={form.nom||''} onChange={v=>set('nom',v)} placeholder="Cuisine, Salon, Chambre 1…" required />
                  <Field label="Ordre d'affichage" value={form.ordre||''} onChange={v=>set('ordre',v)} type="number" placeholder="1" />
                  <button style={css.btnPrimary} onClick={savePiece} disabled={saving}>
                    {saving ? 'Enregistrement…' : '+ Créer la pièce'}
                  </button>
                </>
              )}

              {modal === 'element' && (
                <>
                  <Field label="Nom de l'élément" value={form.nom_el||''} onChange={v=>set('nom_el',v)} placeholder="Robinet, Volet, Radiateur…" required />
                  <SelectField label="Type" value={form.type_el||''} onChange={v=>set('type_el',v)}
                    options={['plomberie','electricite','chauffage','menuiserie','structure','autre']} />
                  <button style={css.btnPrimary} onClick={() => saveElement(selected._pieceId)} disabled={saving}>
                    {saving ? 'Enregistrement…' : '+ Ajouter l\'élément'}
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

function Field({ label, value, onChange, placeholder, type='text', required }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:5, flex:1 }}>
      <label style={css.label}>{label}{required && ' *'}</label>
      <input style={css.input} type={type} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)} />
    </div>
  )
}
function Row({ children }) {
  return <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>{children}</div>
}
function SelectField({ label, value, onChange, options, required }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:5, flex:1 }}>
      <label style={css.label}>{label}{required && ' *'}</label>
      <select style={css.input} value={value} onChange={e => onChange(e.target.value)}>
        <option value="">— Choisir —</option>
        {options.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase()+o.slice(1)}</option>)}
      </select>
    </div>
  )
}

const css = {
  center:      { display:'flex', alignItems:'center', justifyContent:'center', minHeight:300 },
  spinner:     { width:32, height:32, borderRadius:'50%', border:'3px solid #E8F2EB', borderTopColor:'#2D5A3D', animation:'spin 0.8s linear infinite' },
  header:      { display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24, gap:16, flexWrap:'wrap' },
  h1:          { fontFamily:'Georgia,serif', fontSize:24, fontWeight:500, color:'#1A1714', margin:0 },
  sub:         { fontSize:13, color:'#6B6560', margin:'4px 0 0' },
  bienCard:    { background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, overflow:'hidden', marginBottom:16 },
  bienHeader:  { padding:'16px 20px', borderBottom:'1px solid rgba(0,0,0,0.07)', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 },
  bienIcon:    { width:44, height:44, borderRadius:10, background:'#E8F2EB', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 },
  bienAddr:    { fontWeight:600, fontSize:14, color:'#1A1714' },
  bienMeta:    { fontSize:12, color:'#6B6560', marginTop:2 },
  bienBody:    { padding:'16px 20px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 },
  section:     { display:'flex', flexDirection:'column' },
  sectionTitle:{ fontSize:12, fontWeight:600, color:'#6B6560', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:10 },
  locCard:     { background:'#F7F5F0', borderRadius:8, padding:'10px 12px', display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8 },
  locEmpty:    { fontSize:13, color:'#9E9890', display:'flex', alignItems:'center', gap:8 },
  pieceRow:    { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid rgba(0,0,0,0.05)', fontSize:13 },
  badgeGreen:  { padding:'2px 9px', borderRadius:20, background:'#E8F2EB', color:'#2D5A3D', fontSize:11, fontWeight:600, flexShrink:0 },
  emptyCard:   { background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, padding:'48px 32px', display:'flex', flexDirection:'column', alignItems:'center', gap:14, textAlign:'center' },
  emptyTitle:  { fontFamily:'Georgia,serif', fontSize:18, fontWeight:500, margin:0 },
  emptySub:    { fontSize:13, color:'#6B6560', margin:0 },
  overlay:     { position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 },
  modal:       { background:'#fff', borderRadius:14, width:'100%', maxWidth:520, maxHeight:'88vh', overflowY:'auto', boxShadow:'0 8px 32px rgba(0,0,0,0.15)' },
  modalHeader: { padding:'18px 24px 14px', borderBottom:'1px solid rgba(0,0,0,0.08)', display:'flex', alignItems:'center', justifyContent:'space-between' },
  modalTitle:  { fontFamily:'Georgia,serif', fontSize:17, fontWeight:500 },
  closeBtn:    { width:28, height:28, border:'1px solid rgba(0,0,0,0.12)', borderRadius:6, background:'none', cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center' },
  label:       { fontSize:11, fontWeight:600, color:'#6B6560', textTransform:'uppercase', letterSpacing:'.05em' },
  input:       { padding:'9px 12px', border:'1px solid rgba(0,0,0,0.15)', borderRadius:8, fontFamily:'inherit', fontSize:13.5, outline:'none', width:'100%', boxSizing:'border-box' },
  infoBox:     { background:'#EBF2FC', borderRadius:8, padding:'10px 14px', fontSize:12, color:'#2B5EA7', lineHeight:1.6 },
  errorBox:    { background:'#FDEAEA', color:'#B83232', border:'1px solid #F7C1C1', borderRadius:8, padding:'10px 14px', fontSize:13 },
  btnPrimary:  { padding:'9px 18px', background:'#2D5A3D', color:'#fff', border:'none', borderRadius:8, fontFamily:'inherit', fontSize:13, fontWeight:500, cursor:'pointer' },
  btnSm:       { padding:'6px 12px', background:'#fff', color:'#1A1714', border:'1px solid rgba(0,0,0,0.15)', borderRadius:7, fontFamily:'inherit', fontSize:12, cursor:'pointer' },
  btnSmDanger: { padding:'6px 12px', background:'#FDEAEA', color:'#B83232', border:'1px solid rgba(184,50,50,0.2)', borderRadius:7, fontFamily:'inherit', fontSize:12, cursor:'pointer' },
  btnXs:       { padding:'4px 10px', background:'#fff', color:'#2D5A3D', border:'1px solid #2D5A3D', borderRadius:6, fontFamily:'inherit', fontSize:11, cursor:'pointer', whiteSpace:'nowrap' },
}
