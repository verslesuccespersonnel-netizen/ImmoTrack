import React, { useState, useCallback, useEffect } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const MOIS = ['Janvier','Fevrier','Mars','Avril','Mai','Juin','Juillet','Aout','Septembre','Octobre','Novembre','Decembre']

function genHTML(q) {
  const ml  = MOIS[q.mois - 1] + ' ' + q.annee
  const total = (Number(q.loyer)||0) + (Number(q.charges)||0) - (Number(q.remise)||0)
  const joursFin = new Date(q.annee, q.mois, 0).getDate()
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Quittance ${ml}</title>
<style>
  * { box-sizing: border-box; margin:0; padding:0; }
  body { font-family:Georgia,serif; color:#1A1714; padding:40px; background:#fff; font-size:14px; line-height:1.6; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:18px; margin-bottom:24px; border-bottom:3px solid #2D5A3D; }
  .logo { font-size:26px; font-weight:700; }
  .logo .g { color:#2D5A3D; } .logo .a { color:#C8813A; }
  h1 { font-size:20px; text-align:center; margin:20px 0 6px; color:#2D5A3D; text-transform:uppercase; letter-spacing:2px; }
  .periode { text-align:center; font-size:15px; color:#2D5A3D; font-weight:600; margin-bottom:22px; }
  .bloc { background:#F7F5F0; border-radius:8px; padding:16px 18px; margin-bottom:14px; }
  .bloc h3 { font-size:11px; color:#6B6560; text-transform:uppercase; letter-spacing:1px; margin-bottom:10px; font-family:sans-serif; }
  .row { display:flex; justify-content:space-between; padding:5px 0; border-bottom:1px solid rgba(0,0,0,.05); font-size:13px; }
  .row:last-child { border-bottom:none; }
  .total { display:flex; justify-content:space-between; background:#E8F2EB; border-radius:8px; padding:14px 18px; font-size:18px; font-weight:700; color:#2D5A3D; margin:18px 0; }
  .declaration { background:#EBF2FC; border-radius:8px; padding:14px 18px; font-size:13px; line-height:1.8; margin-bottom:20px; }
  .signatures { display:flex; justify-content:space-between; margin-top:32px; }
  .sig { text-align:center; }
  .sig-line { border-top:1.5px solid #1A1714; width:200px; margin:48px auto 8px; }
  .footer { margin-top:28px; padding-top:12px; border-top:1px solid rgba(0,0,0,.08); font-size:10px; color:#9E9890; text-align:center; font-family:sans-serif; }
  .print-btn { display:flex; gap:10px; justify-content:center; margin:20px 0; padding:16px; background:#f7f5f0; border-radius:8px; }
  .print-btn button { padding:10px 24px; border-radius:8px; border:none; cursor:pointer; font-size:14px; font-weight:600; font-family:sans-serif; }
  .btn-print { background:#2D5A3D; color:#fff; }
  .btn-close { background:#F7F5F0; color:#1A1714; border:1px solid rgba(0,0,0,.15) !important; }
  @media print { .print-btn { display:none; } body { padding:20px; } }
</style>
</head>
<body>
  <div class="print-btn">
    <button class="btn-print" onclick="window.print()">🖨️ Imprimer / Enregistrer en PDF</button>
    <button class="btn-close" onclick="window.close()">Fermer</button>
  </div>

  <div class="header">
    <div class="logo"><span class="g">Immo</span><span class="a">Track</span></div>
    <div style="text-align:right; font-size:12px; color:#6B6560; font-family:sans-serif;">
      Emise le : ${new Date().toLocaleDateString('fr-FR')}<br>
      Ref : QT-${q.annee}${String(q.mois).padStart(2,'0')}-${(q.id||'').slice(0,8).toUpperCase()||'DRAFT'}
    </div>
  </div>

  <h1>Quittance de Loyer</h1>
  <div class="periode">${ml}</div>

  <div class="bloc">
    <h3>Bailleur</h3>
    <div class="row"><span>Nom</span><span><strong>${q.proprio_nom||''}</strong></span></div>
    ${q.proprio_adresse ? `<div class="row"><span>Adresse</span><span>${q.proprio_adresse}</span></div>` : ''}
    ${q.proprio_email   ? `<div class="row"><span>Email</span><span>${q.proprio_email}</span></div>` : ''}
  </div>

  <div class="bloc">
    <h3>Locataire</h3>
    <div class="row"><span>Nom</span><span><strong>${q.locataire_nom||''}</strong></span></div>
    <div class="row"><span>Logement</span><span>${q.bien_adresse||''}</span></div>
    <div class="row"><span>Periode</span><span>Du 1er au ${joursFin} ${ml}</span></div>
  </div>

  <div class="bloc">
    <h3>Detail du reglement</h3>
    <div class="row"><span>Loyer hors charges</span><span>${Number(q.loyer||0).toLocaleString('fr-FR')} €</span></div>
    ${(q.charges>0) ? `<div class="row"><span>Provisions sur charges</span><span>${Number(q.charges).toLocaleString('fr-FR')} €</span></div>` : ''}
    ${(q.remise>0)  ? `<div class="row"><span>Remise accordee</span><span style="color:#B83232">- ${Number(q.remise).toLocaleString('fr-FR')} €</span></div>` : ''}
    <div class="row"><span>Mode de paiement</span><span>${q.mode_paiement||'virement'}</span></div>
    <div class="row"><span>Statut</span><span style="color:${q.statut_paiement==='regle'?'#2D5A3D':'#C8813A'}">${q.statut_paiement==='regle'?'Regle':'En attente'}</span></div>
  </div>

  <div class="total">
    <span>Total regle</span>
    <span>${total.toLocaleString('fr-FR')} €</span>
  </div>

  <div class="declaration">
    Je soussigne(e) <strong>${q.proprio_nom||'[Bailleur]'}</strong> reconnais avoir recu de
    <strong>${q.locataire_nom||'[Locataire]'}</strong> la somme de
    <strong>${total.toLocaleString('fr-FR')} euros</strong>
    au titre du loyer et des charges du logement situe au
    <strong>${q.bien_adresse||'[Adresse]'}</strong>
    pour la periode du 1er au ${joursFin} ${ml}.
    Et lui en donne bonne et valable quittance, sous reserve de tous mes droits.
  </div>

  <div class="signatures">
    <div class="sig">
      <div style="font-size:12px;color:#6B6560;font-family:sans-serif;">Le bailleur</div>
      <div class="sig-line"></div>
      <div style="font-size:12px;font-family:sans-serif;">${q.proprio_nom||''}</div>
    </div>
    <div class="sig">
      <div style="font-size:12px;color:#6B6560;font-family:sans-serif;">Date</div>
      <div class="sig-line"></div>
      <div style="font-size:12px;font-family:sans-serif;">${new Date().toLocaleDateString('fr-FR')}</div>
    </div>
  </div>

  <div class="footer">
    Document genere par ImmoTrack &mdash; ${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}
  </div>
</body>
</html>`
}

export default function Quittances() {
  const { session, profile } = useAuth()
  const [quittances, setQuittances] = useState([])
  const [locations,  setLocations]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [modal,      setModal]      = useState(null)
  const [form,       setForm]       = useState({})
  const [saving,     setSaving]     = useState(false)
  const [formErr,    setFormErr]    = useState('')

  const now          = new Date()
  const defaultMois  = now.getMonth() + 1
  const defaultAnnee = now.getFullYear()

  const load = useCallback(async () => {
    if (!session?.user || !profile?.role) return
    setLoading(true)
    try {
      const isAdmin = profile.role === 'admin'
      const isMgr   = ['proprietaire','gestionnaire','agence','admin'].includes(profile.role)
      if (!isMgr) { setLoading(false); return }

      let bienIds = []
      if (isAdmin) {
        const { data: b } = await supabase.from('biens').select('id')
        bienIds = (b||[]).map(x=>x.id)
      } else {
        const { data: b } = await supabase.from('biens').select('id').eq('proprietaire_id', session.user.id)
        bienIds = (b||[]).map(x=>x.id)
      }

      let locsData = []
      if (bienIds.length > 0) {
        const { data: lr } = await supabase.from('locations')
          .select(`id, loyer_mensuel, charges,
            bien_id, locataire_id,
            biens!locations_bien_id_fkey(adresse,ville),
            profiles!locataire_id(nom,prenom,email)`)
          .in('bien_id', bienIds)
          .eq('statut','actif')
        locsData = lr || []
      }
      setLocations(locsData)

      const { data: qdocs } = await supabase.from('documents')
        .select('*').eq('type','Quittance').order('created_at',{ascending:false})
      setQuittances(qdocs || [])
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [session?.user?.id, profile?.role, location.key])

  useEffect(() => { load() }, [load])

  function set(k,v) { setForm(f=>({...f,[k]:v})) }

  function openModal(loc) {
    setFormErr('')
    setForm({
      location_id:     loc.id,
      bien_id:         loc.bien_id,
      locataire_id:    loc.locataire_id,
      locataire_nom:   loc.profiles ? loc.profiles.prenom+' '+loc.profiles.nom : 'Locataire',
      locataire_email: loc.profiles?.email || '',
      bien_adresse:    loc.biens ? loc.biens.adresse+', '+loc.biens.ville : '',
      proprio_nom:     (profile.prenom||'')+' '+(profile.nom||''),
      proprio_adresse: profile.adresse || '',
      proprio_email:   session.user.email || '',
      loyer:           loc.loyer_mensuel || 0,
      charges:         loc.charges || 0,
      remise:          0,
      mois:            defaultMois,
      annee:           defaultAnnee,
      statut_paiement: 'regle',
      mode_paiement:   'virement',
    })
    setModal('create')
  }

  // Ouvre la quittance dans un nouvel onglet avec bouton imprimer/PDF
  function ouvrirApercu(data) {
    const html = genHTML(data)
    const win  = window.open('','_blank')
    if (win) { win.document.write(html); win.document.close() }
  }

  async function genererQuittance(envoyerAuLocataire) {
    if (!form.location_id || !form.mois || !form.annee) {
      setFormErr('Location, mois et annee obligatoires'); return
    }
    setSaving(true); setFormErr('')
    try {
      const html = genHTML(form)
      const blob = new Blob([html], {type:'text/html'})
      const nomFichier = `Quittance_${MOIS[form.mois-1]}_${form.annee}_${(form.locataire_nom||'loc').replace(/\s+/g,'_')}.html`

      // Upload Storage → fallback data URL
      let urlDoc = null
      const path = `quittances/${session.user.id}/${Date.now()}_${nomFichier}`
      const { error: upErr } = await supabase.storage.from('documents').upload(path, blob, {contentType:'text/html'})
      if (!upErr) {
        const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path)
        urlDoc = publicUrl
      }
      if (!urlDoc) {
        urlDoc = await new Promise(res => {
          const r = new FileReader()
          r.onload = () => res(r.result)
          r.readAsDataURL(blob)
        })
      }

      // INSERT documents (meta=JSON)
      const { data: doc, error: docErr } = await supabase.from('documents').insert({
        nom:         nomFichier,
        type:        'Quittance',
        url:         urlDoc,
        bien_id:     form.bien_id,
        uploaded_by: session.user.id,
        favori:      false,
        meta:        JSON.stringify({
          location_id: form.location_id,
          locataire_id: form.locataire_id,
          mois: form.mois, annee: form.annee,
          loyer: form.loyer, charges: form.charges,
          remise: form.remise, statut_paiement: form.statut_paiement,
        }),
      }).select().single()
      if (docErr) throw docErr

      // Message automatique si locataire lié
      if (form.locataire_id) {
        const contenu = envoyerAuLocataire
          ? `Bonjour ${form.locataire_nom},\n\nVotre quittance de loyer pour ${MOIS[form.mois-1]} ${form.annee} est disponible.\nMontant : ${((Number(form.loyer)||0)+(Number(form.charges)||0)-(Number(form.remise)||0)).toLocaleString('fr-FR')} euros.\n\nVous pouvez la consulter, l'imprimer ou l'enregistrer en PDF depuis votre espace Documents.`
          : `Quittance ${MOIS[form.mois-1]} ${form.annee} disponible dans vos documents. Montant : ${((Number(form.loyer)||0)+(Number(form.charges)||0)-(Number(form.remise)||0)).toLocaleString('fr-FR')} euros.`

        const { error: msgErr } = await supabase.from('messages').insert({
          expediteur:   session.user.id,
          destinataire: form.locataire_id,
          contenu,
        })
        if (msgErr) console.warn('Message non envoye:', msgErr.message)
      }

      setModal(null)
      await load()

      // Ouvrir apercu avec bouton imprimer
      ouvrirApercu({...form, id: doc?.id})

    } catch(e) { setFormErr(e.message) }
    finally { setSaving(false) }
  }

  if (loading) return <Layout><div className="it-center"><div className="it-spinner"/></div></Layout>

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Quittances de loyer</h1>
          <p className="page-sub">{locations.length} location(s) active(s) — {quittances.length} quittance(s) emise(s)</p>
        </div>
      </div>

      {locations.length === 0 ? (
        <div className="card">
          <div className="card-body" style={{textAlign:'center',padding:40,color:'#9E9890'}}>
            Aucune location active. Attribuez un locataire a un bien depuis le menu Biens.
          </div>
        </div>
      ) : (
        <>
          <div style={{fontWeight:600,fontSize:14,marginBottom:12,color:'#2D5A3D'}}>
            Generer une quittance
          </div>
          <div className="grid3" style={{gap:10,marginBottom:24}}>
            {locations.map(loc => {
              const total = (Number(loc.loyer_mensuel||0)) + (Number(loc.charges||0))
              const nom   = loc.profiles ? loc.profiles.prenom+' '+loc.profiles.nom : 'Locataire sans compte'
              const adresse = loc.biens?.adresse || 'Bien inconnu'
              return (
                <div key={loc.id} className="card" style={{cursor:'pointer'}} onClick={() => openModal(loc)}>
                  <div className="card-body" style={{padding:14}}>
                    <div style={{fontSize:20,marginBottom:6}}>🧾</div>
                    <div style={{fontWeight:600,fontSize:13,marginBottom:2}}>{nom}</div>
                    <div style={{fontSize:12,color:'#6B6560',marginBottom:6}}>{adresse}</div>
                    <div style={{fontSize:12,fontWeight:600,color:'#2D5A3D'}}>{total.toLocaleString('fr-FR')} euros/mois</div>
                    {!loc.locataire_id && (
                      <div style={{fontSize:11,color:'#C8813A',marginTop:4}}>⚠️ Locataire sans compte</div>
                    )}
                    <div style={{marginTop:8}}>
                      <span style={{fontSize:11,background:'#E8F2EB',color:'#2D5A3D',padding:'2px 8px',borderRadius:12,fontWeight:600}}>
                        Generer quittance →
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {quittances.length > 0 && (
        <>
          <div style={{fontWeight:600,fontSize:14,marginBottom:12}}>Quittances emises</div>
          <div className="card">
            {quittances.map(q => {
              let meta = {}
              try { meta = JSON.parse(q.meta||'{}') } catch {}
              const ml = meta.mois ? MOIS[meta.mois-1]+' '+meta.annee : ''
              return (
                <div key={q.id} className="row-item">
                  <span style={{fontSize:20}}>🧾</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:500,fontSize:13,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{q.nom}</div>
                    <div style={{fontSize:11,color:'#9E9890'}}>
                      {ml}{meta.loyer ? ' — '+(Number(meta.loyer)+Number(meta.charges||0)).toLocaleString('fr-FR')+' euros' : ''}
                      {' — '+new Date(q.created_at).toLocaleDateString('fr-FR')}
                    </div>
                  </div>
                  {meta.statut_paiement === 'regle'
                    ? <span className="status status-green">Regle</span>
                    : <span className="status status-yellow">En attente</span>}
                  <button className="btn btn-secondary btn-sm"
                    onClick={() => ouvrirApercu({
                      ...meta,
                      id: q.id,
                      proprio_nom:     (profile.prenom||'')+' '+(profile.nom||''),
                      proprio_adresse: profile.adresse||'',
                      proprio_email:   session.user.email||'',
                      locataire_nom:   q.nom?.replace('Quittance_','')?.replace(/_/g,' ')?.replace('.html','') || '',
                      bien_adresse:    '',
                    })}>
                    🖨️ Imprimer / PDF
                  </button>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Modal génération */}
      {modal === 'create' && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setModal(null)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <span className="modal-title">Generer une quittance</span>
              <button className="modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              {formErr && <div className="alert alert-error">{formErr}</div>}

              <div style={{background:'#E8F2EB',borderRadius:8,padding:'10px 14px',marginBottom:12,fontSize:13}}>
                <strong>Locataire :</strong> {form.locataire_nom}
                {form.locataire_email && <span style={{color:'#9E9890',marginLeft:8}}>{form.locataire_email}</span>}<br/>
                <strong>Bien :</strong> {form.bien_adresse}
              </div>

              <div className="grid2">
                <div className="fld">
                  <label>Mois *</label>
                  <select value={form.mois||''} onChange={e=>set('mois',Number(e.target.value))}>
                    {MOIS.map((m,i) => <option key={i+1} value={i+1}>{m}</option>)}
                  </select>
                </div>
                <div className="fld">
                  <label>Annee *</label>
                  <select value={form.annee||''} onChange={e=>set('annee',Number(e.target.value))}>
                    {[defaultAnnee-1, defaultAnnee, defaultAnnee+1].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid2">
                <div className="fld"><label>Loyer HC (euros)</label><input type="number" value={form.loyer||0} onChange={e=>set('loyer',e.target.value)}/></div>
                <div className="fld"><label>Charges (euros)</label><input type="number" value={form.charges||0} onChange={e=>set('charges',e.target.value)}/></div>
              </div>

              <div className="grid2">
                <div className="fld"><label>Remise (euros)</label><input type="number" value={form.remise||0} onChange={e=>set('remise',e.target.value)}/></div>
                <div className="fld">
                  <label>Mode de paiement</label>
                  <select value={form.mode_paiement||'virement'} onChange={e=>set('mode_paiement',e.target.value)}>
                    <option value="virement">Virement bancaire</option>
                    <option value="cheque">Cheque</option>
                    <option value="especes">Especes</option>
                    <option value="prelevement">Prelevement automatique</option>
                  </select>
                </div>
              </div>

              <div className="fld">
                <label>Statut paiement</label>
                <select value={form.statut_paiement||'regle'} onChange={e=>set('statut_paiement',e.target.value)}>
                  <option value="regle">Regle</option>
                  <option value="partiel">Paiement partiel</option>
                  <option value="en_attente">En attente</option>
                </select>
              </div>

              <div style={{background:'#F7F5F0',borderRadius:8,padding:'10px 14px',fontSize:13,marginBottom:4}}>
                <strong>Total : </strong>
                {((Number(form.loyer)||0)+(Number(form.charges)||0)-(Number(form.remise)||0)).toLocaleString('fr-FR')} euros
              </div>

              {!form.locataire_id && (
                <div className="alert alert-warn" style={{fontSize:12}}>
                  Ce locataire n'a pas de compte ImmoTrack — aucun message de notification ne sera envoye.
                </div>
              )}

              <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:4}}>
                <button className="btn btn-secondary" onClick={() => ouvrirApercu(form)} type="button">
                  👁️ Apercu
                </button>
                <button className="btn btn-secondary" onClick={() => genererQuittance(false)} disabled={saving}>
                  💾 Generer et enregistrer
                </button>
                {form.locataire_id && (
                  <button className="btn btn-primary" onClick={() => genererQuittance(true)} disabled={saving}>
                    {saving ? 'Envoi...' : '✉️ Generer et envoyer au locataire'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
