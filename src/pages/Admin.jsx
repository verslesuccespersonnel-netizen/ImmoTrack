// src/pages/Admin.jsx — Interface administration complète
import React, { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const ROLES = ['locataire','proprietaire','gestionnaire','prestataire']
const CONTRATS = [
  { value:'bail_vide',     label:'Bail vide (non meublé)' },
  { value:'bail_meuble',   label:'Bail meublé' },
  { value:'bail_commercial',label:'Bail commercial' },
  { value:'courte_duree',  label:'Courte durée / Saisonnier' },
  { value:'colocation',    label:'Colocation' },
  { value:'saisonnier',    label:'Saisonnier / Airbnb' },
  { value:'autre',         label:'Autre' },
]
const ROLE_COLOR = { locataire:'#2B5EA7', proprietaire:'#2D5A3D', gestionnaire:'#C8813A', prestataire:'#6B6560' }
const ROLE_BG    = { locataire:'#EBF2FC', proprietaire:'#E8F2EB', gestionnaire:'#FDF3E7', prestataire:'#F7F5F0' }

export default function Admin() {
  const { profile: me } = useAuth()
  const [tab, setTab]   = useState('users')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState({ users:[], biens:[], incidents:[], invitations:[] })
  const [modal, setModal] = useState(null) // { type, item }
  const [form, setForm]   = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    const [u, b, i, inv] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('biens').select('*, proprietaire:profiles!biens_proprietaire_id_fkey(nom,prenom), locations(id,statut,locataire_id,loyer_mensuel,locataire:profiles(nom,prenom))').order('created_at', { ascending: false }),
      supabase.from('incidents').select('*, bien:biens(adresse,ville), reporter:profiles!incidents_signale_par_fkey(nom,prenom)').order('created_at', { ascending: false }).limit(100),
      supabase.from('invitations').select('*').order('created_at', { ascending: false }),
    ])
    setData({ users: u.data||[], biens: b.data||[], incidents: i.data||[], invitations: inv.data||[] })
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }
  function openModal(type, item = null) { setModal({ type, item }); setForm(item || {}); setError('') }

  // ── Créer/modifier un profil ────────────────────────────
  async function saveProfile() {
    if (!form.nom || !form.prenom || !form.role) { setError('Nom, prénom et rôle obligatoires.'); return }
    setSaving(true); setError('')
    try {
      if (modal.item) {
        // Modification
        await supabase.from('profiles').update({
          nom: form.nom, prenom: form.prenom, role: form.role,
          telephone: form.telephone||null, telephone2: form.telephone2||null,
          nom_societe: form.nom_societe||null, adresse: form.adresse||null,
          code_postal: form.code_postal||null, ville: form.ville||null,
          notes: form.notes||null,
        }).eq('id', modal.item.id)
      } else {
        // Création via invitation
        openModal('invite_create', null)
        setSaving(false)
        return
      }
      setModal(null); await load()
    } catch(e) { setError(e.message) }
    finally { setSaving(false) }
  }

  // ── Créer une invitation locataire ──────────────────────
  async function saveInvitation() {
    if (!form.email || !form.nom || !form.prenom) { setError('Email, nom et prénom obligatoires.'); return }
    setSaving(true); setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      await supabase.from('invitations').insert({
        email: form.email.toLowerCase().trim(),
        role: form.role || 'locataire',
        nom: form.nom, prenom: form.prenom,
        telephone: form.telephone||null,
        bien_id: form.bien_id||null,
        loyer: form.loyer ? Number(form.loyer) : null,
        date_debut: form.date_debut||null,
        type_contrat: form.type_contrat||null,
        cree_par: session.user.id,
      })

      // Créer aussi un profil pré-rempli si un UUID Auth existe déjà
      // (cas où le locataire a déjà un compte)
      if (form.user_id) {
        await supabase.from('profiles').upsert({
          id: form.user_id, role: form.role||'locataire',
          nom: form.nom, prenom: form.prenom, telephone: form.telephone||null,
        }, { onConflict: 'id' })

        // Créer la location si bien sélectionné
        if (form.bien_id && form.date_debut) {
          await supabase.from('locations').insert({
            bien_id: form.bien_id, locataire_id: form.user_id,
            loyer_mensuel: Number(form.loyer)||0,
            date_debut: form.date_debut,
            date_fin: form.date_fin||null,
            statut: 'actif',
          })
        }
      }

      setModal(null); await load()
    } catch(e) { setError(e.message) }
    finally { setSaving(false) }
  }

  // ── Ajouter garant ──────────────────────────────────────
  async function saveGarant(locationId) {
    if (!form.g_nom || !form.g_prenom) { setError('Nom et prénom obligatoires.'); return }
    setSaving(true); setError('')
    try {
      await supabase.from('garants').insert({
        location_id: locationId,
        nom: form.g_nom, prenom: form.g_prenom,
        telephone: form.g_tel||null, email: form.g_email||null,
        adresse: form.g_adresse||null, lien: form.g_lien||'autre',
        type_caution: form.g_type_caution||'physique',
        montant: form.g_montant ? Number(form.g_montant) : null,
        date_debut: form.g_date_debut||null,
        notes: form.g_notes||null,
      })
      setModal(null); await load()
    } catch(e) { setError(e.message) }
    finally { setSaving(false) }
  }

  // ── Changer le rôle directement ─────────────────────────
  async function changeRole(id, role) {
    await supabase.from('profiles').update({ role }).eq('id', id)
    setData(d => ({ ...d, users: d.users.map(u => u.id===id ? {...u,role} : u) }))
  }

  async function deleteUser(id) {
    if (!window.confirm('Supprimer ce profil ? Le compte Auth reste actif.')) return
    await supabase.from('profiles').delete().eq('id', id)
    await load()
  }

  const filteredUsers = data.users.filter(u => {
    const matchSearch = !search ||
      `${u.prenom} ${u.nom} ${u.email||''}`.toLowerCase().includes(search.toLowerCase())
    const matchRole = filterRole==='all' || u.role===filterRole
    return matchSearch && matchRole
  })

  const stats = {
    total: data.users.length,
    locataires: data.users.filter(u=>u.role==='locataire').length,
    proprietaires: data.users.filter(u=>u.role==='proprietaire').length,
    gestionnaires: data.users.filter(u=>u.role==='gestionnaire').length,
    biens: data.biens.length,
    incidents_ouverts: data.incidents.filter(i=>i.statut!=='resolu').length,
    invitations: data.invitations.filter(i=>i.statut==='en_attente').length,
  }

  if (!['gestionnaire','proprietaire'].includes(me?.role)) {
    return <Layout><div style={{ padding:40, textAlign:'center', color:'#B83232', fontSize:14 }}>⛔ Accès réservé aux administrateurs.</div></Layout>
  }

  if (loading) return <Layout><div style={css.center}><div style={css.spinner}/></div></Layout>

  return (
    <Layout>
      <div style={css.header}>
        <div>
          <h1 style={css.h1}>Administration</h1>
          <p style={css.sub}>Gestion complète des comptes et données</p>
        </div>
        <button style={css.btnPrimary} onClick={() => openModal('invite')}>
          + Créer un locataire
        </button>
      </div>

      {/* STATS */}
      <div style={css.statsGrid}>
        {[
          { icon:'👥', label:'Comptes',          val:stats.total },
          { icon:'🏠', label:'Locataires',        val:stats.locataires },
          { icon:'🏢', label:'Propriétaires',     val:stats.proprietaires },
          { icon:'🏗️', label:'Biens',             val:stats.biens },
          { icon:'⚠️', label:'Incidents ouverts', val:stats.incidents_ouverts },
          { icon:'📬', label:'Invitations',       val:stats.invitations },
        ].map(s => (
          <div key={s.label} style={css.statCard}>
            <div style={{ fontSize:20 }}>{s.icon}</div>
            <div style={{ fontSize:22, fontWeight:700, color:'#1A1714' }}>{s.val}</div>
            <div style={{ fontSize:11, color:'#6B6560' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* TABS */}
      <div style={css.tabs}>
        {[['users','👥 Comptes'],['invitations','📬 Invitations'],['biens','🏢 Biens'],['incidents','⚠️ Incidents']].map(([val,lbl]) => (
          <div key={val} style={{ ...css.tab, ...(tab===val?css.tabActive:{}) }} onClick={()=>setTab(val)}>
            {lbl}
            {val==='invitations' && stats.invitations>0 && (
              <span style={css.tabBadge}>{stats.invitations}</span>
            )}
          </div>
        ))}
      </div>

      {/* ── COMPTES ── */}
      {tab==='users' && (
        <div style={css.card}>
          <div style={css.cardHeader}>
            <span style={css.cardTitle}>Comptes ({filteredUsers.length})</span>
            <div style={{ display:'flex', gap:8 }}>
              <div style={{ display:'flex', gap:4 }}>
                {['all',...ROLES].map(r => (
                  <button key={r} onClick={()=>setFilterRole(r)}
                    style={{ ...css.chip, ...(filterRole===r ? { background:ROLE_COLOR[r]||'#1A1714', color:'#fff', border:`1px solid ${ROLE_COLOR[r]||'#1A1714'}` } : {}) }}>
                    {r==='all' ? 'Tous' : r.charAt(0).toUpperCase()+r.slice(1)}
                  </button>
                ))}
              </div>
              <input style={css.searchInput} placeholder="Rechercher…"
                value={search} onChange={e=>setSearch(e.target.value)} />
            </div>
          </div>
          {filteredUsers.map(u => (
            <div key={u.id} style={css.userRow}>
              <div style={{ ...css.avatar,
                background: ROLE_BG[u.role]||'#F7F5F0',
                color: ROLE_COLOR[u.role]||'#6B6560' }}>
                {u.prenom?.[0]||'?'}{u.nom?.[0]||''}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:600, fontSize:13.5 }}>{u.prenom} {u.nom}</div>
                <div style={{ fontSize:12, color:'#6B6560', marginTop:1 }}>
                  {u.telephone && <span>{u.telephone} · </span>}
                  {u.nom_societe && <span>{u.nom_societe} · </span>}
                  <span style={{ fontFamily:'monospace', fontSize:10, color:'#9E9890' }}>{u.id.slice(0,8)}…</span>
                </div>
              </div>
              <select
                value={u.role}
                onChange={e => changeRole(u.id, e.target.value)}
                style={{ ...css.roleSelect,
                  background: ROLE_BG[u.role]||'#F7F5F0',
                  color: ROLE_COLOR[u.role]||'#6B6560' }}>
                {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase()+r.slice(1)}</option>)}
              </select>
              <div style={{ display:'flex', gap:6 }}>
                <button style={css.btnSm} onClick={() => openModal('profile', u)}>✏️</button>
                {u.id !== me?.id && <button style={css.btnSmDanger} onClick={() => deleteUser(u.id)}>🗑️</button>}
              </div>
            </div>
          ))}
          {filteredUsers.length===0 && <div style={css.empty}>Aucun compte trouvé.</div>}
        </div>
      )}

      {/* ── INVITATIONS ── */}
      {tab==='invitations' && (
        <div style={css.card}>
          <div style={css.cardHeader}>
            <span style={css.cardTitle}>Invitations locataires ({data.invitations.length})</span>
            <button style={css.btnPrimary} onClick={() => openModal('invite')}>+ Nouveau</button>
          </div>
          {data.invitations.length===0 && <div style={css.empty}>Aucune invitation envoyée.</div>}
          {data.invitations.map(inv => (
            <div key={inv.id} style={css.userRow}>
              <div style={{ fontSize:22 }}>📬</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:600, fontSize:13.5 }}>{inv.prenom} {inv.nom}</div>
                <div style={{ fontSize:12, color:'#6B6560' }}>
                  {inv.email} · {inv.type_contrat||'—'} · Loyer: {inv.loyer||'—'} €
                </div>
                <div style={{ fontSize:11, color:'#9E9890' }}>
                  Créée le {new Date(inv.created_at).toLocaleDateString('fr-FR')}
                  · Expire le {new Date(inv.expire_le).toLocaleDateString('fr-FR')}
                </div>
              </div>
              <span style={{ ...css.statusBadge,
                background: inv.statut==='acceptee'?'#E8F2EB':inv.statut==='expiree'?'#FDEAEA':'#EBF2FC',
                color: inv.statut==='acceptee'?'#2D5A3D':inv.statut==='expiree'?'#B83232':'#2B5EA7' }}>
                {inv.statut}
              </span>
              <div style={{ display:'flex', gap:6 }}>
                <button style={css.btnSmDanger} onClick={async () => {
                  if (window.confirm('Supprimer cette invitation ?')) {
                    await supabase.from('invitations').delete().eq('id', inv.id)
                    await load()
                  }
                }}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── BIENS ── */}
      {tab==='biens' && (
        <div style={css.card}>
          <div style={css.cardHeader}><span style={css.cardTitle}>Biens ({data.biens.length})</span></div>
          {data.biens.map(b => {
            const locActive = b.locations?.find(l=>l.statut==='actif')
            return (
              <div key={b.id} style={css.userRow}>
                <div style={{ fontSize:22 }}>🏠</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:600, fontSize:13.5 }}>{b.adresse}, {b.ville}</div>
                  <div style={{ fontSize:12, color:'#6B6560' }}>
                    Propriétaire : {b.proprietaire?.prenom} {b.proprietaire?.nom}
                    {locActive && ` · Locataire : ${locActive.locataire?.prenom||'—'} ${locActive.locataire?.nom||''}`}
                    {locActive && ` · ${locActive.loyer_mensuel} €/mois`}
                  </div>
                </div>
                <span style={{ ...css.statusBadge,
                  background:locActive?'#E8F2EB':'#F7F5F0',
                  color:locActive?'#2D5A3D':'#9E9890' }}>
                  {locActive?'Occupé':'Vacant'}
                </span>
                {locActive && (
                  <button style={css.btnSm} onClick={() => openModal('garant', { locationId: locActive.id })}>
                    + Garant
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── INCIDENTS ── */}
      {tab==='incidents' && (
        <div style={css.card}>
          <div style={css.cardHeader}><span style={css.cardTitle}>Incidents ({data.incidents.length})</span></div>
          {data.incidents.map(i => (
            <div key={i.id} style={css.userRow}>
              <div style={{ fontSize:18 }}>{i.gravite==='urgent'?'🔴':i.gravite==='moyen'?'🟡':'🟢'}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:600, fontSize:13.5 }}>{i.titre}</div>
                <div style={{ fontSize:12, color:'#6B6560' }}>
                  {i.bien?.adresse} · {i.reporter?.prenom} {i.reporter?.nom}
                  · {new Date(i.created_at).toLocaleDateString('fr-FR')}
                </div>
              </div>
              <span style={{ ...css.statusBadge,
                background:i.statut==='resolu'?'#E8F2EB':i.statut==='en_cours'?'#FDF6E3':'#EBF2FC',
                color:i.statut==='resolu'?'#2D5A3D':i.statut==='en_cours'?'#B87E20':'#2B5EA7' }}>
                {i.statut.replace('_',' ')}
              </span>
              <select style={css.roleSelect} value={i.statut}
                onChange={async e => {
                  await supabase.from('incidents').update({ statut:e.target.value }).eq('id',i.id)
                  await load()
                }}>
                <option value="nouveau">Nouveau</option>
                <option value="en_cours">En cours</option>
                <option value="resolu">Résolu</option>
                <option value="annule">Annulé</option>
              </select>
            </div>
          ))}
        </div>
      )}

      {/* ══ MODALS ══ */}
      {modal && (
        <div style={css.overlay} onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div style={css.modal}>
            <div style={css.modalHeader}>
              <span style={css.modalTitle}>
                {modal.type==='profile' ? (modal.item?'✏️ Modifier le profil':'➕ Nouveau profil')
                  : modal.type==='invite' ? '📬 Créer un locataire'
                  : modal.type==='garant' ? '🛡️ Ajouter un garant / caution'
                  : ''}
              </span>
              <button style={css.closeBtn} onClick={()=>setModal(null)}>✕</button>
            </div>
            <div style={{ padding:'18px 22px', overflowY:'auto', maxHeight:'70vh' }}>
              {error && <div style={css.errBox}>{error}</div>}

              {/* ── PROFIL ── */}
              {modal.type==='profile' && (
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  {modal.item && (
                    <div style={{ background:'#F7F5F0', borderRadius:8, padding:'8px 12px', fontSize:11, color:'#9E9890', fontFamily:'monospace' }}>
                      UUID : {modal.item.id}
                    </div>
                  )}
                  <Row>
                    <Fld label="Prénom *" value={form.prenom||''} onChange={v=>set('prenom',v)} />
                    <Fld label="Nom *" value={form.nom||''} onChange={v=>set('nom',v)} />
                  </Row>
                  <Row>
                    <Fld label="Téléphone principal" value={form.telephone||''} onChange={v=>set('telephone',v)} placeholder="06 12 34 56 78" />
                    <Fld label="Téléphone 2" value={form.telephone2||''} onChange={v=>set('telephone2',v)} />
                  </Row>
                  <Fld label="Nom de société / entreprise" value={form.nom_societe||''} onChange={v=>set('nom_societe',v)} />
                  <Row>
                    <Fld label="Adresse" value={form.adresse||''} onChange={v=>set('adresse',v)} />
                    <Fld label="Code postal" value={form.code_postal||''} onChange={v=>set('code_postal',v)} />
                  </Row>
                  <Fld label="Ville" value={form.ville||''} onChange={v=>set('ville',v)} />
                  <SF label="Rôle *" value={form.role||'locataire'} onChange={v=>set('role',v)}
                    options={ROLES.map(r=>({ value:r, label:r.charAt(0).toUpperCase()+r.slice(1) }))} />
                  <Fld label="Notes internes" value={form.notes||''} onChange={v=>set('notes',v)} multiline />
                  <button style={css.btnPrimary} onClick={saveProfile} disabled={saving}>
                    {saving?'Enregistrement…':'💾 Enregistrer'}
                  </button>
                </div>
              )}

              {/* ── INVITATION LOCATAIRE ── */}
              {modal.type==='invite' && (
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  <div style={css.infoBox}>
                    Créez la fiche du locataire. Il recevra une invitation par email pour accéder à son espace.
                    Si son compte existe déjà, renseignez son UUID pour lier directement.
                  </div>

                  <div style={css.sectionLabel}>👤 Identité</div>
                  <Row>
                    <Fld label="Prénom *" value={form.prenom||''} onChange={v=>set('prenom',v)} />
                    <Fld label="Nom *" value={form.nom||''} onChange={v=>set('nom',v)} />
                  </Row>
                  <Row>
                    <Fld label="Email *" value={form.email||''} onChange={v=>set('email',v)} type="email" />
                    <Fld label="Téléphone" value={form.telephone||''} onChange={v=>set('telephone',v)} />
                  </Row>
                  <SF label="Rôle" value={form.role||'locataire'} onChange={v=>set('role',v)}
                    options={ROLES.map(r=>({ value:r, label:r.charAt(0).toUpperCase()+r.slice(1) }))} />
                  <Fld label="UUID Auth (si compte déjà créé)" value={form.user_id||''} onChange={v=>set('user_id',v)}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />

                  <div style={css.sectionLabel}>🏠 Logement & Contrat</div>
                  <SF label="Bien concerné" value={form.bien_id||''} onChange={v=>set('bien_id',v)}
                    options={[{ value:'', label:'— Aucun pour l\'instant —' }, ...data.biens.map(b=>({ value:b.id, label:`${b.adresse}, ${b.ville}` }))]} />
                  <SF label="Type de contrat" value={form.type_contrat||''} onChange={v=>set('type_contrat',v)}
                    options={[{ value:'', label:'— Choisir —' }, ...CONTRATS.map(c=>({ value:c.value, label:c.label }))]} />
                  <Row>
                    <Fld label="Loyer mensuel (€)" value={form.loyer||''} onChange={v=>set('loyer',v)} type="number" />
                    <Fld label="Charges (€)" value={form.charges||''} onChange={v=>set('charges',v)} type="number" />
                  </Row>
                  <Row>
                    <Fld label="Dépôt de garantie (€)" value={form.depot||''} onChange={v=>set('depot',v)} type="number" />
                    <Fld label="Durée bail (mois)" value={form.duree||''} onChange={v=>set('duree',v)} type="number" />
                  </Row>
                  <Row>
                    <Fld label="Date d'entrée" value={form.date_debut||''} onChange={v=>set('date_debut',v)} type="date" />
                    <Fld label="Date de sortie prévue" value={form.date_fin||''} onChange={v=>set('date_fin',v)} type="date" />
                  </Row>

                  <button style={css.btnPrimary} onClick={saveInvitation} disabled={saving}>
                    {saving?'Enregistrement…':'📬 Créer le locataire'}
                  </button>
                </div>
              )}

              {/* ── GARANT ── */}
              {modal.type==='garant' && (
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  <div style={css.sectionLabel}>👤 Identité du garant</div>
                  <Row>
                    <Fld label="Prénom *" value={form.g_prenom||''} onChange={v=>set('g_prenom',v)} />
                    <Fld label="Nom *" value={form.g_nom||''} onChange={v=>set('g_nom',v)} />
                  </Row>
                  <Row>
                    <Fld label="Téléphone" value={form.g_tel||''} onChange={v=>set('g_tel',v)} />
                    <Fld label="Email" value={form.g_email||''} onChange={v=>set('g_email',v)} type="email" />
                  </Row>
                  <Fld label="Adresse" value={form.g_adresse||''} onChange={v=>set('g_adresse',v)} />

                  <div style={css.sectionLabel}>🛡️ Caution</div>
                  <SF label="Lien avec le locataire" value={form.g_lien||''} onChange={v=>set('g_lien',v)}
                    options={[
                      { value:'parent', label:'Parent / Famille' },
                      { value:'ami', label:'Ami' },
                      { value:'organisme', label:'Organisme (Visale, Action Logement…)' },
                      { value:'employeur', label:'Employeur' },
                      { value:'autre', label:'Autre' },
                    ]} />
                  <SF label="Type de caution" value={form.g_type_caution||'physique'} onChange={v=>set('g_type_caution',v)}
                    options={[
                      { value:'physique', label:'Caution physique (personne)' },
                      { value:'morale', label:'Caution morale (société)' },
                      { value:'visale', label:'Visale / Action Logement' },
                      { value:'bancaire', label:'Caution bancaire' },
                    ]} />
                  <Row>
                    <Fld label="Montant garanti (€)" value={form.g_montant||''} onChange={v=>set('g_montant',v)} type="number" />
                    <Fld label="Date de début" value={form.g_date_debut||''} onChange={v=>set('g_date_debut',v)} type="date" />
                  </Row>
                  <Fld label="Notes" value={form.g_notes||''} onChange={v=>set('g_notes',v)} multiline />

                  <button style={css.btnPrimary} onClick={() => saveGarant(modal.item.locationId)} disabled={saving}>
                    {saving?'Enregistrement…':'🛡️ Ajouter le garant'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

// ── Composants form helpers ──────────────────────────────
function Fld({ label, value, onChange, type='text', placeholder, multiline }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:4, flex:1 }}>
      <label style={css.lbl}>{label}</label>
      {multiline
        ? <textarea style={{ ...css.inp, minHeight:70, resize:'vertical' }} value={value}
            placeholder={placeholder} onChange={e=>onChange(e.target.value)} />
        : <input style={css.inp} type={type} value={value} placeholder={placeholder}
            onChange={e=>onChange(e.target.value)} />
      }
    </div>
  )
}
function Row({ children }) {
  return <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>{children}</div>
}
function SF({ label, value, onChange, options }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
      <label style={css.lbl}>{label}</label>
      <select style={css.inp} value={value} onChange={e=>onChange(e.target.value)}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
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
  statsGrid:   { display:'grid', gridTemplateColumns:'repeat(6,minmax(0,1fr))', gap:10, marginBottom:18 },
  statCard:    { background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:10, padding:'12px', display:'flex', flexDirection:'column', gap:4, alignItems:'center', textAlign:'center' },
  tabs:        { display:'flex', borderBottom:'1px solid rgba(0,0,0,0.08)', marginBottom:0 },
  tab:         { padding:'10px 16px', fontSize:13, fontWeight:500, color:'#6B6560', cursor:'pointer', borderBottom:'2px solid transparent', display:'flex', alignItems:'center', gap:6 },
  tabActive:   { color:'#2D5A3D', borderBottomColor:'#2D5A3D' },
  tabBadge:    { background:'#B83232', color:'white', borderRadius:10, fontSize:9, fontWeight:700, padding:'1px 5px' },
  card:        { background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:12, overflow:'hidden' },
  cardHeader:  { padding:'12px 16px', borderBottom:'1px solid rgba(0,0,0,0.07)', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 },
  cardTitle:   { fontWeight:600, fontSize:13.5 },
  userRow:     { display:'flex', alignItems:'center', gap:10, padding:'10px 16px', borderBottom:'1px solid rgba(0,0,0,0.05)', flexWrap:'wrap' },
  avatar:      { width:34, height:34, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, flexShrink:0 },
  roleSelect:  { padding:'4px 8px', borderRadius:20, border:'none', fontFamily:'inherit', fontSize:11, fontWeight:600, cursor:'pointer', outline:'none' },
  statusBadge: { padding:'3px 9px', borderRadius:20, fontSize:11, fontWeight:600, flexShrink:0 },
  chip:        { padding:'4px 10px', borderRadius:20, border:'1px solid rgba(0,0,0,0.12)', background:'#fff', fontSize:11, fontWeight:500, cursor:'pointer', fontFamily:'inherit' },
  searchInput: { padding:'6px 11px', border:'1px solid rgba(0,0,0,0.15)', borderRadius:8, fontFamily:'inherit', fontSize:12, outline:'none', width:160 },
  empty:       { padding:'28px', textAlign:'center', color:'#9E9890', fontSize:13 },
  overlay:     { position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 },
  modal:       { background:'#fff', borderRadius:14, width:'100%', maxWidth:520, maxHeight:'90vh', overflowY:'hidden', boxShadow:'0 8px 32px rgba(0,0,0,0.15)', display:'flex', flexDirection:'column' },
  modalHeader: { padding:'16px 22px 12px', borderBottom:'1px solid rgba(0,0,0,0.08)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 },
  modalTitle:  { fontFamily:'Georgia,serif', fontSize:16, fontWeight:500 },
  closeBtn:    { width:26, height:26, border:'1px solid rgba(0,0,0,0.12)', borderRadius:5, background:'none', cursor:'pointer', fontSize:13 },
  lbl:         { fontSize:10, fontWeight:600, color:'#6B6560', textTransform:'uppercase', letterSpacing:'.05em' },
  inp:         { padding:'8px 11px', border:'1px solid rgba(0,0,0,0.15)', borderRadius:7, fontFamily:'inherit', fontSize:13.5, outline:'none', width:'100%', boxSizing:'border-box' },
  infoBox:     { background:'#EBF2FC', borderRadius:8, padding:'10px 14px', fontSize:12, color:'#2B5EA7', lineHeight:1.6 },
  sectionLabel:{ fontSize:11, fontWeight:700, color:'#6B6560', textTransform:'uppercase', letterSpacing:'.06em', marginTop:4 },
  errBox:      { background:'#FDEAEA', color:'#B83232', borderRadius:7, padding:'9px 12px', fontSize:12, marginBottom:4 },
  btnPrimary:  { padding:'10px', background:'#2D5A3D', color:'#fff', border:'none', borderRadius:8, fontFamily:'inherit', fontSize:13, fontWeight:500, cursor:'pointer' },
  btnSm:       { padding:'5px 11px', background:'#fff', color:'#1A1714', border:'1px solid rgba(0,0,0,0.15)', borderRadius:7, fontFamily:'inherit', fontSize:12, cursor:'pointer' },
  btnSmDanger: { padding:'5px 11px', background:'#FDEAEA', color:'#B83232', border:'1px solid rgba(184,50,50,0.2)', borderRadius:7, fontFamily:'inherit', fontSize:12, cursor:'pointer' },
}
