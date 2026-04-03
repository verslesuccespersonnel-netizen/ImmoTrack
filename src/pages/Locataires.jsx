import React, { useEffect, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const CONTRATS = [
  {v:'bail_vide',l:'Bail vide'},{v:'bail_meuble',l:'Bail meublé'},{v:'bail_commercial',l:'Bail commercial'},
  {v:'courte_duree',l:'Courte durée / Airbnb'},{v:'colocation',l:'Colocation'},{v:'autre',l:'Autre'},
]

export default function Locataires() {
  const { session } = useAuth()
  const [locs, setLocs]     = useState([])
  const [biens, setBiens]   = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]   = useState(null)
  const [form, setForm]     = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const [exp, setExp]       = useState(null)

  useEffect(() => { if (session) load() }, [session])

  async function load() {
    setLoading(true)
    const [locsRes, biensRes] = await Promise.all([
      supabase.from('locations').select('*, biens!locations_bien_id_fkey(id,adresse,ville), profiles!locataire_id(id,nom,prenom,telephone), garants(*), occupants(*)').order('created_at',{ascending:false}),
      supabase.from('biens').select('id,adresse,ville').eq('proprietaire_id',session.user.id),
    ])
    const myIds = (biensRes.data||[]).map(b=>b.id)
    setLocs((locsRes.data||[]).filter(l=>myIds.includes(l.bien_id)))
    setBiens(biensRes.data||[])
    setLoading(false)
  }

  function set(k,v) { setForm(f=>({...f,[k]:v})) }

  async function save() {
    if (!form.nom||!form.prenom||!form.bien_id||!form.loyer||!form.date_debut) {
      setError('Nom, prénom, bien, loyer et date d\'entrée requis'); return
    }
    setSaving(true); setError('')
    try {
      const { data: loc } = await supabase.from('locations').insert({
        bien_id: form.bien_id, locataire_id: form.user_id||null,
        loyer_mensuel: Number(form.loyer), date_debut: form.date_debut,
        date_fin: form.date_fin||null, statut:'actif',
      }).select().single()
      await supabase.from('occupants').insert({ location_id:loc.id, nom:form.nom, prenom:form.prenom, lien:'titulaire', date_naissance:form.dob||null })
      if (!form.user_id) {
        await supabase.from('invitations').insert({
          email:(form.email||`loc-${loc.id}@immotrack.app`).toLowerCase(), role:'locataire',
          nom:form.nom, prenom:form.prenom, telephone:form.telephone||null,
          bien_id:form.bien_id, loyer:Number(form.loyer), date_debut:form.date_debut,
          type_contrat:form.type_contrat||null, cree_par:session.user.id,
        }).catch(()=>{})
      }
      setModal(null); await load()
    } catch(e) { setError(e.message) }
    finally { setSaving(false) }
  }

  async function addGarant() {
    if (!form.g_nom||!form.g_prenom) { setError('Nom et prénom du garant requis'); return }
    setSaving(true)
    await supabase.from('garants').insert({ location_id:modal.locationId, nom:form.g_nom, prenom:form.g_prenom, telephone:form.g_tel||null, email:form.g_email||null, lien:form.g_lien||'autre', type_caution:form.g_type||'physique', montant:form.g_montant?Number(form.g_montant):null })
    setSaving(false); setModal(null); await load()
  }

  async function addOccupant() {
    if (!form.o_nom||!form.o_prenom) return
    await supabase.from('occupants').insert({ location_id:modal.locationId, nom:form.o_nom, prenom:form.o_prenom, lien:form.o_lien||'autre', date_naissance:form.o_dob||null })
    setModal(null); await load()
  }

  if (loading) return <Layout><div className="it-center"><div className="it-spinner"/></div></Layout>

  return (
    <Layout>
      <div className="page-header">
        <div><h1 className="page-title">Locataires</h1><p className="page-sub">{locs.filter(l=>l.statut==='actif').length} active(s)</p></div>
        <button className="btn btn-primary" onClick={()=>{ setForm({}); setError(''); setModal({type:'create'}) }}>+ Ajouter</button>
      </div>

      {locs.length===0 && <div className="card"><div className="card-body" style={{textAlign:'center',padding:32,color:'#9E9890'}}>Aucune location enregistrée.</div></div>}

      {locs.map(loc => (
        <div key={loc.id} className="card" style={{ marginBottom:12 }}>
          <div className="card-header" style={{ cursor:'pointer' }} onClick={()=>setExp(exp===loc.id?null:loc.id)}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:36,height:36,borderRadius:'50%',background:'#EBF2FC',color:'#2B5EA7',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,flexShrink:0 }}>
                {loc.profiles?.prenom?.[0]||'?'}{loc.profiles?.nom?.[0]||''}
              </div>
              <div>
                <div style={{ fontWeight:600, fontSize:14 }}>
                  {loc.profiles ? `${loc.profiles.prenom} ${loc.profiles.nom}` : `${loc.occupants?.[0]?.prenom||'?'} ${loc.occupants?.[0]?.nom||''} ⚠️ compte non créé`}
                </div>
                <div style={{ fontSize:12, color:'#6B6560' }}>
                  {loc.biens?.adresse} · {Number(loc.loyer_mensuel).toLocaleString('fr-FR')} €/mois · depuis {new Date(loc.date_debut).toLocaleDateString('fr-FR')}
                </div>
              </div>
            </div>
            <div style={{ display:'flex', gap:6, alignItems:'center' }}>
              <span className={`status ${loc.statut==='actif'?'status-green':'status-grey'}`}>{loc.statut}</span>
              <span style={{ color:'#9E9890' }}>{exp===loc.id?'▲':'▼'}</span>
            </div>
          </div>
          {exp===loc.id && (
            <div className="card-body">
              {loc.profiles?.telephone && <p style={{ fontSize:13, marginBottom:8 }}>📞 {loc.profiles.telephone}</p>}
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
                <button className="btn btn-secondary btn-sm" onClick={()=>{ setForm({}); setError(''); setModal({type:'occupant',locationId:loc.id}) }}>+ Occupant</button>
                <button className="btn btn-secondary btn-sm" onClick={()=>{ setForm({}); setError(''); setModal({type:'garant',locationId:loc.id}) }}>+ Garant</button>
                {loc.statut==='actif' && <button className="btn btn-danger btn-sm" onClick={async()=>{ if(window.confirm('Terminer cette location ?')) { await supabase.from('locations').update({statut:'termine',date_fin:new Date().toISOString().split('T')[0]}).eq('id',loc.id); await load() } }}>Terminer</button>}
              </div>
              {(loc.occupants||[]).length>0 && (
                <div style={{ marginBottom:10 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'#9E9890', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:5 }}>Occupants</div>
                  {loc.occupants.map(o=><div key={o.id} style={{ fontSize:13, padding:'4px 0', borderBottom:'1px solid rgba(0,0,0,.05)' }}>{o.prenom} {o.nom} <span style={{ color:'#9E9890', fontSize:11 }}>({o.lien}){o.date_naissance?` · ${new Date().getFullYear()-new Date(o.date_naissance).getFullYear()} ans`:''}</span></div>)}
                </div>
              )}
              {(loc.garants||[]).length>0 && (
                <div>
                  <div style={{ fontSize:10, fontWeight:700, color:'#9E9890', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:5 }}>Garants / Cautions</div>
                  {loc.garants.map(g=><div key={g.id} style={{ fontSize:13, padding:'4px 0', borderBottom:'1px solid rgba(0,0,0,.05)' }}>{g.prenom} {g.nom} <span style={{ color:'#9E9890', fontSize:11 }}>· {g.type_caution}{g.montant?` · ${Number(g.montant).toLocaleString('fr-FR')} €`:''}{g.telephone?` · ${g.telephone}`:''}</span></div>)}
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {modal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">{modal.type==='create'?'Nouveau locataire':modal.type==='garant'?'Ajouter un garant':'Ajouter un occupant'}</span>
              <button className="modal-close" onClick={()=>setModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error">{error}</div>}
              {modal.type==='create' && <>
                <div className="grid2"><div className="fld"><label>Prénom *</label><input value={form.prenom||''} onChange={e=>set('prenom',e.target.value)} /></div><div className="fld"><label>Nom *</label><input value={form.nom||''} onChange={e=>set('nom',e.target.value)} /></div></div>
                <div className="grid2"><div className="fld"><label>Email</label><input type="email" value={form.email||''} onChange={e=>set('email',e.target.value)} /></div><div className="fld"><label>Téléphone</label><input value={form.telephone||''} onChange={e=>set('telephone',e.target.value)} /></div></div>
                <div className="fld"><label>Date de naissance</label><input type="date" value={form.dob||''} onChange={e=>set('dob',e.target.value)} /></div>
                <div className="fld"><label>UUID du compte (si déjà créé)</label><input value={form.user_id||''} onChange={e=>set('user_id',e.target.value)} placeholder="Laisser vide si pas encore de compte" /></div>
                <div className="fld"><label>Bien *</label><select value={form.bien_id||''} onChange={e=>set('bien_id',e.target.value)}><option value="">— Choisir —</option>{biens.map(b=><option key={b.id} value={b.id}>{b.adresse}, {b.ville}</option>)}</select></div>
                <div className="fld"><label>Type de contrat</label><select value={form.type_contrat||''} onChange={e=>set('type_contrat',e.target.value)}><option value="">— Choisir —</option>{CONTRATS.map(c=><option key={c.v} value={c.v}>{c.l}</option>)}</select></div>
                <div className="grid2"><div className="fld"><label>Loyer HC (€) *</label><input type="number" value={form.loyer||''} onChange={e=>set('loyer',e.target.value)} /></div><div className="fld"><label>Charges (€)</label><input type="number" value={form.charges||''} onChange={e=>set('charges',e.target.value)} /></div></div>
                <div className="grid2"><div className="fld"><label>Date d'entrée *</label><input type="date" value={form.date_debut||''} onChange={e=>set('date_debut',e.target.value)} /></div><div className="fld"><label>Date de sortie prévue</label><input type="date" value={form.date_fin||''} onChange={e=>set('date_fin',e.target.value)} /></div></div>
                <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'Création…':'✅ Créer'}</button>
              </>}
              {modal.type==='garant' && <>
                <div className="grid2"><div className="fld"><label>Prénom *</label><input value={form.g_prenom||''} onChange={e=>set('g_prenom',e.target.value)} /></div><div className="fld"><label>Nom *</label><input value={form.g_nom||''} onChange={e=>set('g_nom',e.target.value)} /></div></div>
                <div className="grid2"><div className="fld"><label>Téléphone</label><input value={form.g_tel||''} onChange={e=>set('g_tel',e.target.value)} /></div><div className="fld"><label>Email</label><input type="email" value={form.g_email||''} onChange={e=>set('g_email',e.target.value)} /></div></div>
                <div className="fld"><label>Lien</label><select value={form.g_lien||''} onChange={e=>set('g_lien',e.target.value)}>{['parent','ami','organisme','employeur','autre'].map(l=><option key={l} value={l}>{l}</option>)}</select></div>
                <div className="fld"><label>Type de caution</label><select value={form.g_type||'physique'} onChange={e=>set('g_type',e.target.value)}>{[['physique','Personne physique'],['morale','Personne morale'],['visale','Visale'],['bancaire','Caution bancaire']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
                <div className="fld"><label>Montant garanti (€)</label><input type="number" value={form.g_montant||''} onChange={e=>set('g_montant',e.target.value)} /></div>
                <button className="btn btn-primary" onClick={addGarant} disabled={saving}>{saving?'…':'🛡️ Ajouter'}</button>
              </>}
              {modal.type==='occupant' && <>
                <div className="grid2"><div className="fld"><label>Prénom *</label><input value={form.o_prenom||''} onChange={e=>set('o_prenom',e.target.value)} /></div><div className="fld"><label>Nom *</label><input value={form.o_nom||''} onChange={e=>set('o_nom',e.target.value)} /></div></div>
                <div className="grid2"><div className="fld"><label>Date de naissance</label><input type="date" value={form.o_dob||''} onChange={e=>set('o_dob',e.target.value)} /></div><div className="fld"><label>Lien</label><select value={form.o_lien||'autre'} onChange={e=>set('o_lien',e.target.value)}>{['titulaire','conjoint','enfant','colocataire','autre'].map(l=><option key={l} value={l}>{l}</option>)}</select></div></div>
                <button className="btn btn-primary" onClick={addOccupant}>+ Ajouter</button>
              </>}
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
