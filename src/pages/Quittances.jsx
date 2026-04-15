import React, { useState, useCallback, useEffect } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const MOIS = ['Janvier','Fevrier','Mars','Avril','Mai','Juin','Juillet','Aout','Septembre','Octobre','Novembre','Decembre']

function genererHTMLQuittance(q) {
  const moisLabel = MOIS[q.mois - 1] + ' ' + q.annee
  const total = Number(q.loyer) + Number(q.charges || 0)
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Quittance ${moisLabel}</title>
<style>
  body { font-family: 'Georgia', serif; color: #1A1714; margin: 0; padding: 40px; background: #fff; }
  .header { border-bottom: 3px solid #2D5A3D; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-start; }
  .logo { font-size: 28px; font-weight: 700; }
  .logo span:first-child { color: #2D5A3D; }
  .logo span:last-child { color: #C8813A; }
  h1 { font-size: 22px; text-align: center; margin: 20px 0; color: #2D5A3D; letter-spacing: 2px; text-transform: uppercase; }
  .section { background: #F7F5F0; border-radius: 8px; padding: 18px; margin-bottom: 18px; }
  .section h3 { margin: 0 0 12px; font-size: 13px; color: #6B6560; text-transform: uppercase; letter-spacing: 1px; }
  .row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(0,0,0,.06); font-size: 15px; }
  .row:last-child { border-bottom: none; }
  .total { background: #E8F2EB; border-radius: 8px; padding: 16px 18px; display: flex; justify-content: space-between; font-size: 18px; font-weight: 700; color: #2D5A3D; margin: 20px 0; }
  .signature { margin-top: 40px; display: flex; justify-content: space-between; }
  .sig-box { text-align: center; }
  .sig-line { border-top: 2px solid #1A1714; width: 220px; margin: 60px auto 8px; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid rgba(0,0,0,.1); font-size: 11px; color: #9E9890; text-align: center; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>
  <div class="header">
    <div class="logo"><span>Immo</span><span>Track</span></div>
    <div style="text-align:right; font-size:13px; color:#6B6560;">
      Date d'emission : ${new Date().toLocaleDateString('fr-FR')}<br>
      Reference : QT-${q.annee}${String(q.mois).padStart(2,'0')}-${q.id?.slice(0,8).toUpperCase() || 'DRAFT'}
    </div>
  </div>
  
  <h1>Quittance de Loyer</h1>
  <p style="text-align:center; font-size:16px; color:#2D5A3D; font-weight:600; margin-bottom:24px;">${moisLabel}</p>
  
  <div class="section">
    <h3>Bailleur</h3>
    <div class="row"><span>Nom</span><span><strong>${q.proprio_nom || ''}</strong></span></div>
    <div class="row"><span>Adresse</span><span>${q.proprio_adresse || ''}</span></div>
    ${q.proprio_email ? `<div class="row"><span>Email</span><span>${q.proprio_email}</span></div>` : ''}
  </div>
  
  <div class="section">
    <h3>Locataire</h3>
    <div class="row"><span>Nom</span><span><strong>${q.locataire_nom || ''}</strong></span></div>
    <div class="row"><span>Bien loue</span><span>${q.bien_adresse || ''}</span></div>
    <div class="row"><span>Periode</span><span>Du 1er au ${new Date(q.annee, q.mois, 0).getDate()} ${moisLabel}</span></div>
  </div>
  
  <div class="section">
    <h3>Detail du reglement</h3>
    <div class="row"><span>Loyer hors charges</span><span>${Number(q.loyer).toLocaleString('fr-FR')} euros</span></div>
    ${q.charges > 0 ? `<div class="row"><span>Provisions sur charges</span><span>${Number(q.charges).toLocaleString('fr-FR')} euros</span></div>` : ''}
    ${q.remise > 0 ? `<div class="row"><span>Remise accordee</span><span>- ${Number(q.remise).toLocaleString('fr-FR')} euros</span></div>` : ''}
  </div>
  
  <div class="total">
    <span>Total regle</span>
    <span>${(total - (q.remise||0)).toLocaleString('fr-FR')} euros</span>
  </div>
  
  <p style="font-size:14px; line-height:1.8; background:#EBF2FC; padding:14px 18px; border-radius:8px;">
    Je soussigne(e) <strong>${q.proprio_nom || '[Bailleur]'}</strong> reconnais avoir recu de
    <strong>${q.locataire_nom || '[Locataire]'}</strong> la somme de
    <strong>${(total - (q.remise||0)).toLocaleString('fr-FR')} euros</strong>
    au titre du loyer et des charges du logement situe au
    <strong>${q.bien_adresse || '[Adresse]'}</strong>
    pour la periode du 1er au ${new Date(q.annee, q.mois, 0).getDate()} ${moisLabel}.
    Et lui en donne bonne et valable quittance, sous reserve de tous mes droits.
  </p>
  
  <div class="signature">
    <div class="sig-box">
      <div style="font-size:13px; color:#6B6560; margin-bottom:4px;">Le bailleur</div>
      <div class="sig-line"></div>
      <div style="font-size:12px;">${q.proprio_nom || ''}</div>
    </div>
    <div class="sig-box">
      <div style="font-size:13px; color:#6B6560; margin-bottom:4px;">Date</div>
      <div class="sig-line"></div>
      <div style="font-size:12px;">${new Date().toLocaleDateString('fr-FR')}</div>
    </div>
  </div>
  
  <div class="footer">
    Document genere par ImmoTrack - ${new Date().toLocaleDateString('fr-FR')} a ${new Date().toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'})}
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
  const [preview,    setPreview]    = useState(null)

  const now = new Date()
  const defaultMois  = now.getMonth() + 1
  const defaultAnnee = now.getFullYear()

  const load = useCallback(async () => {
    if (!session?.user || !profile) return
    setLoading(true)
    try {
      const isAdmin = profile.role === 'admin'

      const biensRes = isAdmin
        ? await supabase.from('biens').select('id')
        : await supabase.from('biens').select('id').eq('proprietaire_id', session.user.id)
      const myBienIds = (biensRes.data || []).map(b => b.id)

      // Charger les locations actives
      let locsData = []
      if (myBienIds.length > 0) {
        const lr = await supabase.from('locations')
          .select('id, loyer_mensuel, charges, bien_id, locataire_id, biens!locations_bien_id_fkey(adresse, ville), profiles!locataire_id(nom, prenom, email)')
          .in('bien_id', myBienIds)
          .eq('statut', 'actif')
        locsData = lr.data || []
      } else if (isAdmin) {
        const lr = await supabase.from('locations')
          .select('id, loyer_mensuel, charges, bien_id, locataire_id, biens!locations_bien_id_fkey(adresse, ville), profiles!locataire_id(nom, prenom, email)')
          .eq('statut', 'actif')
        locsData = lr.data || []
      }
      setLocations(locsData)

      // Charger les quittances existantes depuis la table documents
      const { data: qdocs } = await supabase.from('documents')
        .select('*')
        .eq('type', 'Quittance')
        .order('created_at', { ascending: false })
      setQuittances(qdocs || [])

    } catch(e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [session?.user?.id, profile?.role])

  useEffect(() => { load() }, [load])

  function set(k, v) { setForm(f => ({...f, [k]: v})) }

  function openModal(loc) {
    const proprio = profile
    setFormErr('')
    setForm({
      location_id:     loc.id,
      bien_id:         loc.bien_id,
      locataire_id:    loc.locataire_id,
      locataire_nom:   loc.profiles ? loc.profiles.prenom + ' ' + loc.profiles.nom : '',
      locataire_email: loc.profiles?.email || '',
      bien_adresse:    loc.biens ? loc.biens.adresse + ', ' + loc.biens.ville : '',
      proprio_nom:     (proprio.prenom || '') + ' ' + (proprio.nom || ''),
      proprio_adresse: proprio.adresse || '',
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

  async function genererQuittance() {
    if (!form.location_id || !form.mois || !form.annee) {
      setFormErr('Location, mois et annee sont obligatoires')
      return
    }
    setSaving(true); setFormErr('')
    try {
      const html = genererHTMLQuittance(form)
      const blob = new Blob([html], {type:'text/html'})
      const nomFichier = `Quittance_${MOIS[form.mois-1]}_${form.annee}_${form.locataire_nom?.replace(' ','_') || 'locataire'}.html`

      // Sauvegarder dans Supabase Storage si disponible, sinon en base64
      let urlDoc = null
      try {
        const path = `quittances/${session.user.id}/${Date.now()}_${nomFichier}`
        const { error: upErr } = await supabase.storage.from('documents').upload(path, blob, {contentType:'text/html'})
        if (!upErr) {
          const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path)
          urlDoc = publicUrl
        }
      } catch {}

      // Fallback : data URL
      if (!urlDoc) {
        const reader = new FileReader()
        urlDoc = await new Promise(res => {
          reader.onload = () => res(reader.result)
          reader.readAsDataURL(blob)
        })
      }

      // Enregistrer dans la table documents
      const { data: doc, error: docErr } = await supabase.from('documents').insert({
        nom:          nomFichier,
        type:         'Quittance',
        url:          urlDoc,
        bien_id:      form.bien_id,
        uploaded_by:  session.user.id,
        favori:       false,
        meta: JSON.stringify({
          location_id:     form.location_id,
          locataire_id:    form.locataire_id,
          mois:            form.mois,
          annee:           form.annee,
          loyer:           form.loyer,
          charges:         form.charges,
          remise:          form.remise,
          statut_paiement: form.statut_paiement,
        }),
      }).select().single()

      if (docErr) throw docErr

      // Notifier le locataire via un message
      if (form.locataire_id) {
        await supabase.from('messages').insert({
          expediteur:   session.user.id,
          destinataire: form.locataire_id,
          contenu:      `Votre quittance de loyer pour ${MOIS[form.mois-1]} ${form.annee} est disponible dans vos documents. Montant : ${(Number(form.loyer) + Number(form.charges||0) - Number(form.remise||0)).toLocaleString('fr-FR')} euros.`,
        }).catch(() => {})
      }

      setModal(null)
      await load()

      // Proposer le telechargement
      const a = document.createElement('a')
      a.href = urlDoc
      a.download = nomFichier
      a.target = '_blank'
      a.click()

    } catch(e) {
      setFormErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  function previsualiser() {
    const html = genererHTMLQuittance(form)
    const win = window.open('', '_blank')
    if (win) { win.document.write(html); win.document.close() }
  }

  if (loading) return <Layout><div className="it-center"><div className="it-spinner"/></div></Layout>

  const unreadNotif = 0

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Quittances de loyer</h1>
          <p className="page-sub">{locations.length} location(s) active(s) - {quittances.length} quittance(s) emise(s)</p>
        </div>
      </div>

      {locations.length === 0 && (
        <div className="card">
          <div className="card-body" style={{textAlign:'center', padding:40, color:'#9E9890'}}>
            Aucune location active. Attribuez un locataire a un bien pour generer des quittances.
          </div>
        </div>
      )}

      {/* Locations actives - generateur */}
      {locations.length > 0 && (
        <>
          <div style={{fontWeight:600, fontSize:14, marginBottom:12, color:'#2D5A3D'}}>
            Generer une quittance
          </div>
          <div className="grid3" style={{gap:10, marginBottom:24}}>
            {locations.map(loc => {
              const total = Number(loc.loyer_mensuel||0) + Number(loc.charges||0)
              const nom   = loc.profiles ? loc.profiles.prenom + ' ' + loc.profiles.nom : 'Locataire sans compte'
              const adresse = loc.biens ? loc.biens.adresse : 'Bien inconnu'
              return (
                <div key={loc.id} className="card" style={{cursor:'pointer'}} onClick={() => openModal(loc)}>
                  <div className="card-body" style={{padding:14}}>
                    <div style={{fontSize:20, marginBottom:6}}>🧾</div>
                    <div style={{fontWeight:600, fontSize:13, marginBottom:2}}>{nom}</div>
                    <div style={{fontSize:12, color:'#6B6560', marginBottom:6}}>{adresse}</div>
                    <div style={{fontSize:12, fontWeight:600, color:'#2D5A3D'}}>{total.toLocaleString('fr-FR')} euros/mois</div>
                    <div style={{marginTop:8}}>
                      <span style={{fontSize:11, background:'#E8F2EB', color:'#2D5A3D', padding:'2px 8px', borderRadius:12, fontWeight:600}}>
                        Generer quittance
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Quittances emises */}
      {quittances.length > 0 && (
        <>
          <div style={{fontWeight:600, fontSize:14, marginBottom:12}}>Quittances emises</div>
          <div className="card">
            {quittances.map(q => {
              let meta = {}
              try { meta = JSON.parse(q.meta || '{}') } catch {}
              const moisLabel = meta.mois ? MOIS[meta.mois-1] + ' ' + meta.annee : ''
              return (
                <div key={q.id} className="row-item">
                  <span style={{fontSize:20}}>🧾</span>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:500, fontSize:13}}>{q.nom}</div>
                    <div style={{fontSize:11, color:'#9E9890'}}>
                      {moisLabel}
                      {meta.loyer ? ' - ' + (Number(meta.loyer)+Number(meta.charges||0)).toLocaleString('fr-FR') + ' euros' : ''}
                      {' - Emise le ' + new Date(q.created_at).toLocaleDateString('fr-FR')}
                    </div>
                  </div>
                  {meta.statut_paiement === 'regle'
                    ? <span className="status status-green">Regle</span>
                    : <span className="status status-yellow">En attente</span>
                  }
                  <a href={q.url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
                    Ouvrir
                  </a>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Modal generation */}
      {modal === 'create' && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <span className="modal-title">Generer une quittance</span>
              <button className="modal-close" onClick={() => setModal(null)}>X</button>
            </div>
            <div className="modal-body">
              {formErr && <div className="alert alert-error">{formErr}</div>}

              <div style={{background:'#E8F2EB', borderRadius:8, padding:'10px 14px', marginBottom:12, fontSize:13}}>
                <strong>Locataire :</strong> {form.locataire_nom || 'Sans compte'}<br/>
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
              <div className="fld"><label>Remise accordee (euros)</label><input type="number" value={form.remise||0} onChange={e=>set('remise',e.target.value)} placeholder="0 si aucune remise"/></div>

              <div className="grid2">
                <div className="fld">
                  <label>Statut paiement</label>
                  <select value={form.statut_paiement||'regle'} onChange={e=>set('statut_paiement',e.target.value)}>
                    <option value="regle">Regle</option>
                    <option value="partiel">Partiel</option>
                    <option value="en_attente">En attente</option>
                  </select>
                </div>
                <div className="fld">
                  <label>Mode de paiement</label>
                  <select value={form.mode_paiement||'virement'} onChange={e=>set('mode_paiement',e.target.value)}>
                    <option value="virement">Virement bancaire</option>
                    <option value="cheque">Cheque</option>
                    <option value="especes">Especes</option>
                    <option value="prelevement">Prelevement</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>
              </div>

              <div style={{background:'#F7F5F0', borderRadius:8, padding:'10px 14px', fontSize:13, marginBottom:12}}>
                <strong>Total a percevoir : </strong>
                {((Number(form.loyer)||0) + (Number(form.charges)||0) - (Number(form.remise)||0)).toLocaleString('fr-FR')} euros
                {form.locataire_id && <span style={{color:'#9E9890', fontSize:11, marginLeft:8}}>(Le locataire sera notifie par message)</span>}
              </div>

              <div style={{display:'flex', gap:8}}>
                <button className="btn btn-secondary" onClick={previsualiser} type="button">
                  Previsualiser
                </button>
                <button className="btn btn-primary" onClick={genererQuittance} disabled={saving}>
                  {saving ? 'Generation...' : 'Generer et enregistrer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
