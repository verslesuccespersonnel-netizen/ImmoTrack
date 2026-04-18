import React, { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const ROLES_D = {
  locataire:    { color:'#2B5EA7', bg:'#EBF2FC', icon:'🏠' },
  proprietaire: { color:'#2D5A3D', bg:'#E8F2EB', icon:'🏢' },
  agence:       { color:'#C8813A', bg:'#FDF3E7', icon:'🏗️' },
  admin:        { color:'#B83232', bg:'#FDEAEA', icon:'⚙️' },
  prestataire:  { color:'#6B6560', bg:'#F7F5F0', icon:'🔧' },
  gestionnaire: { color:'#C8813A', bg:'#FDF3E7', icon:'🏗️' },
}
const MGR = ['proprietaire','gestionnaire','agence','admin']

export default function Admin() {
  const { profile: me, session } = useAuth()
  const isAdmin = me?.role === 'admin'
  const isMgr   = MGR.includes(me?.role)

  const [tab,       setTab]      = useState('users')
  const [users,     setUsers]    = useState([])
  const [biens,     setBiens]    = useState([])
  const [incidents, setInc]      = useState([])
  const [loading,   setLoading]  = useState(true)
  const [search,    setSearch]   = useState('')
  const [filterRole,setFilter]   = useState('all')
  const [modal,     setModal]    = useState(null)  // { type: 'edit'|'create'|'assign', ...data }
  const [form,      setForm]     = useState({})
  const [saving,    setSaving]   = useState(false)
  const [formErr,   setFormErr]  = useState('')
  const [confirm,   setConfirm]  = useState(null)
  const [opMsg,     setOpMsg]    = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [uR, bR, iR] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('biens').select('*, profiles!biens_proprietaire_id_fkey(nom,prenom), locations(id,statut,loyer_mensuel,profiles!locataire_id(nom,prenom))').order('created_at', { ascending: false }),
        isAdmin ? supabase.from('incidents').select('*, biens(adresse), profiles!signale_par(nom,prenom)').order('created_at', { ascending: false }).limit(50) : Promise.resolve({data:[]}),
      ])
      setUsers(uR.data || [])
      setBiens(bR.data || [])
      setInc(iR.data || [])
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [isAdmin])

  useEffect(() => { load() }, [load])

  function set(k, v) { setForm(f => ({...f, [k]: v})) }
  const rd = r => ROLES_D[r] || ROLES_D.prestataire

  async function saveUser() {
    setSaving(true); setFormErr('')
    try {
      await supabase.from('profiles').update({
        nom: form.nom, prenom: form.prenom, role: form.role,
        telephone: form.telephone || null,
        email: form.email || null,
        nom_societe: form.nom_societe || null,
        notes: form.notes || null,
      }).eq('id', modal.id)
      setModal(null); await load()
    } catch(e) { setFormErr(e.message) }
    finally { setSaving(false) }
  }

  async function changeRole(id, role) {
    await supabase.from('profiles').update({ role }).eq('id', id)
    setUsers(prev => prev.map(u => u.id === id ? {...u, role} : u))
  }

  // Inviter un utilisateur par email (envoie un magic link / invite)
  async function inviterParEmail() {
    if (!form.email_invite) { setFormErr('Email requis'); return }
    if (!form.role_invite)  { setFormErr('Rôle requis'); return }
    setSaving(true); setFormErr('')
    try {
      // Créer via signUp - l'utilisateur recevra un email de confirmation
      const { data, error: e } = await supabase.auth.admin?.inviteUserByEmail
        ? await supabase.auth.admin.inviteUserByEmail(form.email_invite, {
            data: { role: form.role_invite, prenom: form.prenom_invite||'', nom: form.nom_invite||'' }
          })
        : { data: null, error: null }

      // Fallback : créer une invitation dans la table invitations
      await supabase.from('invitations').insert({
        email: form.email_invite.toLowerCase().trim(),
        role: form.role_invite,
        nom: form.nom_invite || null,
        prenom: form.prenom_invite || null,
        cree_par: session.user.id,
        bien_id: form.bien_id_invite || null,
      })

      setOpMsg(`Invitation envoyée à ${form.email_invite}. Le compte sera visible dès que l'utilisateur se connecte.`)
      setModal(null); await load()
    } catch(e) { setFormErr(e.message) }
    finally { setSaving(false) }
  }

  // Créer un compte directement (admin only)
  async function creerCompteDirecte() {
    if (!form.dc_email || !form.dc_role) { setFormErr('Email et rôle requis'); return }
    if (!form.dc_nom || !form.dc_prenom) { setFormErr('Nom et prénom requis'); return }
    setSaving(true); setFormErr('')
    try {
      // Créer le compte via signUp avec mot de passe temporaire
      const tempPass = 'ImmoTrack2024!'
      const { data, error: e } = await supabase.auth.signUp({
        email: form.dc_email.trim().toLowerCase(),
        password: tempPass,
        options: { data: { prenom: form.dc_prenom, nom: form.dc_nom, role: form.dc_role } },
      })
      if (e) throw e

      if (data.user) {
        // Mettre à jour le profil créé par le trigger
        await new Promise(r => setTimeout(r, 500))
        await supabase.from('profiles').upsert({
          id: data.user.id,
          email: form.dc_email.trim().toLowerCase(),
          nom: form.dc_nom, prenom: form.dc_prenom,
          role: form.dc_role,
          telephone: form.dc_tel || null,
        })
      }

      setOpMsg(`Compte créé pour ${form.dc_email}. Mot de passe provisoire : ImmoTrack2024! — Demandez-leur de le changer.`)
      setModal(null); await load()
    } catch(e) { setFormErr(e.message) }
    finally { setSaving(false) }
  }

  // Assigner un locataire à un bien (créer une location)
  async function assignerLocataire() {
    if (!form.a_locataire_id || !form.a_bien_id || !form.a_loyer || !form.a_date) {
      setFormErr('Locataire, bien, loyer et date requis'); return
    }
    setSaving(true); setFormErr('')
    try {
      // Terminer l'éventuelle location active sur ce bien
      const active = biens.find(b=>b.id===form.a_bien_id)?.locations?.find(l=>l.statut==='actif')
      if (active) await supabase.from('locations').update({ statut:'termine', date_fin: new Date().toISOString().split('T')[0] }).eq('id', active.id)
      await supabase.from('locations').insert({
        bien_id: form.a_bien_id,
        locataire_id: form.a_locataire_id,
        loyer_mensuel: Number(form.a_loyer),
        date_debut: form.a_date,
        type_contrat: form.a_contrat || null,
        statut: 'actif',
      })
      setOpMsg('Locataire assigné au bien.')
      setModal(null); await load()
    } catch(e) { setFormErr(e.message) }
    finally { setSaving(false) }
  }

  // Assigner un proprio à une agence
  async function assignerProprio() {
    if (!form.ap_proprio_id || !form.ap_agence_id) { setFormErr('Propriétaire et agence requis'); return }
    setSaving(true); setFormErr('')
    try {
      const { error: upsErr } = await supabase.from('agence_proprietaires').upsert({
        agence_id: form.ap_agence_id,
        proprietaire_id: form.ap_proprio_id,
      })
      if (upsErr) {
        // Table absente : fallback sur agence_id dans profiles
        await supabase.from('profiles').update({ agence_id: form.ap_agence_id }).eq('id', form.ap_proprio_id)
      }
      setOpMsg('Propriétaire assigné à l\'agence.')
      setModal(null); await load()
    } catch(e) { setFormErr(e.message) }
    finally { setSaving(false) }
  }

  // Supprimer un utilisateur (cascade propre)
  async function deleteUser(userId) {
    setConfirm(null)
    setOpMsg('Suppression en cours...')
    try {
      // Récupérer les locations de ce locataire
      const { data: locs } = await supabase.from('locations').select('id').eq('locataire_id', userId)
      const locIds = (locs || []).map(l => l.id)

      // Supprimer en cascade dans l'ordre FK
      if (locIds.length > 0) {
        await supabase.from('occupants').delete().in('location_id', locIds)
        await supabase.from('garants').delete().in('location_id', locIds)
      }
      await supabase.from('tchat_membres').delete().eq('user_id', userId)
      await supabase.from('tchat_messages').delete().eq('user_id', userId)
      await supabase.from('locations').delete().eq('locataire_id', userId)
      await supabase.from('incidents').delete().eq('signale_par', userId)
      await supabase.from('messages').delete().or(`expediteur.eq.${userId},destinataire.eq.${userId}`)
      await supabase.from('documents').delete().eq('uploaded_by', userId)
      const { error: e } = await supabase.from('profiles').delete().eq('id', userId)
      if (e) throw e

      setOpMsg('Profil et données supprimés. Supprimez aussi le compte dans Supabase > Authentication > Users.')
      await load()
    } catch(e) { setOpMsg('Erreur : ' + e.message) }
  }

  async function deleteAll(type) {
    setConfirm(null)
    setOpMsg('Suppression en cours...')
    try {
      const fake = '00000000-0000-0000-0000-000000000001'
      if (type === 'all_plans') {
        await supabase.from('plan_equipements').delete().neq('id', fake)
        await supabase.from('plan_pieces').delete().neq('id', fake)
        setOpMsg('Plans supprimés.')
      } else if (type === 'all_incidents') {
        await supabase.from('incidents').delete().neq('id', fake)
        setOpMsg('Incidents supprimés.')
      } else if (type === 'all_locations') {
        await supabase.from('garants').delete().neq('id', fake)
        await supabase.from('occupants').delete().neq('id', fake)
        await supabase.from('locations').delete().neq('id', fake)
        setOpMsg('Locations supprimées.')
      } else if (type === 'all_data') {
        await supabase.from('plan_equipements').delete().neq('id', fake)
        await supabase.from('plan_pieces').delete().neq('id', fake)
        await supabase.from('garants').delete().neq('id', fake)
        await supabase.from('occupants').delete().neq('id', fake)
        await supabase.from('incidents').delete().neq('id', fake)
        await supabase.from('messages').delete().neq('id', fake)
        await supabase.from('documents').delete().neq('id', fake)
        await supabase.from('locations').delete().neq('id', fake)
        await supabase.from('biens').delete().neq('id', fake)
        await supabase.from('profiles').delete().neq('role', 'admin')
        setOpMsg('Toutes les données supprimées (sauf comptes admin). Nettoyez aussi Supabase > Authentication > Users.')
      }
      await load()
    } catch(e) { setOpMsg('Erreur : ' + e.message) }
  }

  async function exportData() {
    const [uR, bR, lR, iR] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('biens').select('*'),
      supabase.from('locations').select('*'),
      supabase.from('incidents').select('*'),
    ])
    const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), profiles: uR.data, biens: bR.data, locations: lR.data, incidents: iR.data }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `immotrack-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const filtUsers = users.filter(u => {
    const ms = !search || `${u.prenom||''} ${u.nom||''} ${u.email||''}`.toLowerCase().includes(search.toLowerCase())
    return ms && (filterRole === 'all' || u.role === filterRole)
  })

  const locataires = users.filter(u => u.role === 'locataire')
  const proprietaires = users.filter(u => u.role === 'proprietaire')
  const agences = users.filter(u => u.role === 'agence' || u.role === 'gestionnaire')

  if (loading) return <Layout><div className="it-center"><div className="it-spinner"/></div></Layout>

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Administration</h1>
          <p className="page-sub">{users.length} compte(s) · {biens.length} bien(s)</p>
        </div>
        <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
          {isAdmin && <button className="btn btn-secondary" onClick={exportData}>Exporter JSON</button>}
          {isAdmin && <button className="btn btn-secondary" onClick={() => { setFormErr(''); setForm({}); setModal({type:'create'}) }}>+ Créer un compte</button>}
          {isMgr   && <button className="btn btn-primary"   onClick={() => { setFormErr(''); setForm({}); setModal({type:'invite'}) }}>✉️ Inviter</button>}
        </div>
      </div>

      {opMsg && (
        <div className={`alert ${opMsg.startsWith('Erreur') ? 'alert-error' : 'alert-success'}`}
          style={{ marginBottom:16, position:'relative' }}>
          {opMsg}
          <button onClick={() => setOpMsg('')} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:16 }}>✕</button>
        </div>
      )}

      <div className="grid3" style={{ marginBottom:16 }}>
        {[['👥', users.length, 'Comptes'], ['🏢', biens.length, 'Biens'], ['⚠️', incidents.filter(i=>i.statut!=='resolu').length, 'Incidents ouverts']].map(([ic,v,l]) => (
          <div key={l} className="stat-card"><div className="stat-val">{ic} {v}</div><div className="stat-label">{l}</div></div>
        ))}
      </div>

      {/* Onglets */}
      <div style={{ display:'flex', borderBottom:'1px solid rgba(0,0,0,.08)', marginBottom:0 }}>
        {[['users','Comptes'], ['biens','Biens'], ['assign','Associations'], ...(isAdmin ? [['incidents','Incidents'],['tools','Outils']] : [])].map(([v,l]) => (
          <div key={v} onClick={() => setTab(v)}
            style={{ padding:'10px 16px', cursor:'pointer', fontSize:13, fontWeight:500,
              color: tab===v?'#2D5A3D':'#6B6560',
              borderBottom: tab===v?'2px solid #2D5A3D':'2px solid transparent' }}>
            {l}
          </div>
        ))}
      </div>

      {/* COMPTES */}
      {tab === 'users' && (
        <div className="card" style={{ borderRadius:'0 0 12px 12px', borderTop:'none' }}>
          <div className="card-header">
            <span className="card-title">{filtUsers.length} compte(s)</span>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {['all','locataire','proprietaire','agence','admin','prestataire'].map(r => (
                <button key={r} className={`btn btn-xs ${filterRole===r?'btn-primary':'btn-secondary'}`}
                  onClick={() => setFilter(r)}>{r==='all'?'Tous':r}</button>
              ))}
              <input style={{ padding:'5px 9px', border:'1px solid rgba(0,0,0,.15)', borderRadius:7, fontSize:12, outline:'none', width:160 }}
                placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)}/>
            </div>
          </div>
          {filtUsers.map(u => (
            <div key={u.id} className="row-item">
              <div style={{ width:34, height:34, borderRadius:'50%', background:rd(u.role).bg, color:rd(u.role).color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>
                {rd(u.role).icon}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:500, fontSize:13 }}>{u.prenom} {u.nom}</div>
                <div style={{ fontSize:11, color:'#9E9890' }}>
                  {u.email || 'Email non renseigné'}
                  {u.telephone ? ' · ' + u.telephone : ''}
                </div>
                <div style={{ fontSize:10, color:'#C0BDB8', fontFamily:'monospace', marginTop:1 }}>{u.id}</div>
              </div>
              {isAdmin ? (
                <select value={u.role} onChange={e => changeRole(u.id, e.target.value)}
                  style={{ padding:'4px 8px', borderRadius:20, border:'none', fontFamily:'inherit', fontSize:11, fontWeight:600, background:rd(u.role).bg, color:rd(u.role).color, cursor:'pointer', outline:'none' }}>
                  {Object.keys(ROLES_D).map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              ) : (
                <span style={{ padding:'3px 9px', borderRadius:20, fontSize:11, fontWeight:600, background:rd(u.role).bg, color:rd(u.role).color }}>{u.role}</span>
              )}
              {isAdmin && <button className="btn btn-secondary btn-sm" onClick={() => { setForm({...u}); setFormErr(''); setModal({type:'edit', id:u.id}) }}>Modifier</button>}
              {isAdmin && u.id !== me?.id && <button className="btn btn-danger btn-sm" onClick={() => setConfirm({type:'user', id:u.id, label:`${u.prenom} ${u.nom} (${u.role})`})}>Supprimer</button>}
            </div>
          ))}
          {filtUsers.length === 0 && <div className="card-body" style={{ textAlign:'center', color:'#9E9890' }}>Aucun compte.</div>}
        </div>
      )}

      {/* BIENS */}
      {tab === 'biens' && (
        <div className="card" style={{ borderRadius:'0 0 12px 12px', borderTop:'none' }}>
          <div className="card-header"><span className="card-title">{biens.length} bien(s)</span></div>
          {biens.map(b => {
            const loc = b.locations?.find(l => l.statut === 'actif')
            return (
              <div key={b.id} className="row-item">
                <span style={{ fontSize:20 }}>🏠</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:500, fontSize:13 }}>{b.adresse}, {b.ville}</div>
                  <div style={{ fontSize:11, color:'#9E9890' }}>
                    Proprio : {b.profiles?.prenom} {b.profiles?.nom}
                    {loc ? ` · ${loc.profiles?.prenom||'—'} ${loc.profiles?.nom||''} · ${Number(loc.loyer_mensuel||0).toLocaleString('fr-FR')} €` : ''}
                  </div>
                </div>
                <span className={`status ${loc?'status-green':'status-grey'}`}>{loc?'Occupé':'Vacant'}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* ASSOCIATIONS */}
      {tab === 'assign' && (
        <div className="card" style={{ borderRadius:'0 0 12px 12px', borderTop:'none' }}>
          <div className="card-body">
            <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
              <button className="btn btn-primary" onClick={() => { setFormErr(''); setForm({}); setModal({type:'assign_loc'}) }}>
                🔗 Assigner locataire → bien
              </button>
              <button className="btn btn-secondary" onClick={() => { setFormErr(''); setForm({}); setModal({type:'assign_prop'}) }}>
                🏗️ Assigner propriétaire → agence
              </button>
            </div>
            <div style={{ marginTop:16 }}>
              <div style={{ fontSize:12, fontWeight:600, color:'#6B6560', marginBottom:8 }}>Locataires sans logement ({locataires.filter(l => !biens.some(b => b.locations?.some(loc => loc.locataire_id === l.id && loc.statut === 'actif'))).length})</div>
              {locataires.filter(l => !biens.some(b => b.locations?.some(loc => loc.locataire_id === l.id && loc.statut === 'actif'))).map(u => (
                <div key={u.id} className="row-item">
                  <span style={{ fontSize:16 }}>🏠</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:500 }}>{u.prenom} {u.nom}</div>
                    <div style={{ fontSize:11, color:'#9E9890' }}>{u.email || 'Sans email'}</div>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={() => { setFormErr(''); setForm({ a_locataire_id: u.id }); setModal({type:'assign_loc'}) }}>
                    Assigner un bien
                  </button>
                </div>
              ))}
              {locataires.filter(l => !biens.some(b => b.locations?.some(loc => loc.locataire_id === l.id && loc.statut === 'actif'))).length === 0 && (
                <div style={{ fontSize:13, color:'#9E9890', padding:'8px 0' }}>Tous les locataires ont un logement.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* INCIDENTS */}
      {tab === 'incidents' && isAdmin && (
        <div className="card" style={{ borderRadius:'0 0 12px 12px', borderTop:'none' }}>
          <div className="card-header"><span className="card-title">{incidents.length} incident(s)</span></div>
          {incidents.map(i => (
            <div key={i.id} className="row-item">
              <span style={{ fontSize:16 }}>{i.gravite==='urgent'?'🔴':i.gravite==='moyen'?'🟡':'🟢'}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:500, fontSize:13 }}>{i.titre}</div>
                <div style={{ fontSize:11, color:'#9E9890' }}>{i.biens?.adresse} · {i.profiles?.prenom} {i.profiles?.nom}</div>
              </div>
              <select value={i.statut}
                onChange={async e => { await supabase.from('incidents').update({statut:e.target.value}).eq('id',i.id); await load() }}
                style={{ padding:'4px 8px', borderRadius:7, border:'1px solid rgba(0,0,0,.15)', fontFamily:'inherit', fontSize:11, outline:'none' }}>
                {['nouveau','en_cours','en_attente','resolu','annule'].map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}

      {/* OUTILS */}
      {tab === 'tools' && isAdmin && (
        <div className="card" style={{ borderRadius:'0 0 12px 12px', borderTop:'none' }}>
          <div className="card-body">
            <div className="alert alert-warn" style={{ marginBottom:12 }}>Ces opérations sont irréversibles.</div>
            <div className="alert alert-info" style={{ marginBottom:16, fontSize:12 }}>
              La suppression d'un compte retire le profil et les données, mais le compte auth.users reste dans Supabase.
              Pour le supprimer complètement : Supabase Dashboard > Authentication > Users > Delete.
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {[
                { type:'all_plans',     label:'Supprimer tous les plans 2D',   danger:false },
                { type:'all_incidents', label:'Supprimer tous les incidents',   danger:false },
                { type:'all_locations', label:'Supprimer toutes les locations', danger:true  },
                { type:'all_data',      label:'TOUT SUPPRIMER (hors admins)',   danger:true  },
              ].map(op => (
                <div key={op.type} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'11px 14px', border:`1px solid ${op.danger?'rgba(184,50,50,.3)':'rgba(0,0,0,.08)'}`, borderRadius:10, background:op.danger?'#FDEAEA':'#FAFAF8' }}>
                  <span style={{ fontSize:13, color:op.danger?'#B83232':'#1A1714', fontWeight:500 }}>{op.label}</span>
                  <button className={`btn btn-sm ${op.danger?'btn-danger':'btn-secondary'}`} onClick={() => setConfirm({type:op.type, label:op.label})}>Supprimer</button>
                </div>
              ))}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'11px 14px', border:'1px solid rgba(0,0,0,.08)', borderRadius:10, background:'#F7F5F0' }}>
                <span style={{ fontSize:13, fontWeight:500 }}>Exporter toutes les données (JSON)</span>
                <button className="btn btn-secondary btn-sm" onClick={exportData}>Exporter</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODALS ═══ */}

      {/* Modifier un profil */}
      {modal?.type === 'edit' && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-header"><span className="modal-title">Modifier le profil</span><button className="modal-close" onClick={() => setModal(null)}>✕</button></div>
            <div className="modal-body">
              {formErr && <div className="alert alert-error">{formErr}</div>}
              <div style={{ fontSize:10, color:'#9E9890', fontFamily:'monospace', marginBottom:6, wordBreak:'break-all' }}>UUID: {modal.id}</div>
              <div className="grid2">
                <div className="fld"><label>Prénom</label><input value={form.prenom||''} onChange={e=>set('prenom',e.target.value)}/></div>
                <div className="fld"><label>Nom</label><input value={form.nom||''} onChange={e=>set('nom',e.target.value)}/></div>
              </div>
              <div className="fld"><label>Email</label><input type="email" value={form.email||''} onChange={e=>set('email',e.target.value)} placeholder="Lecture seule dans Supabase Auth"/></div>
              <div className="grid2">
                <div className="fld"><label>Téléphone</label><input value={form.telephone||''} onChange={e=>set('telephone',e.target.value)}/></div>
                <div className="fld"><label>Société</label><input value={form.nom_societe||''} onChange={e=>set('nom_societe',e.target.value)}/></div>
              </div>
              <div className="fld">
                <label>Rôle</label>
                <select value={form.role||'locataire'} onChange={e=>set('role',e.target.value)}>
                  {Object.keys(ROLES_D).map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="fld"><label>Notes</label><textarea value={form.notes||''} onChange={e=>set('notes',e.target.value)}/></div>
              <button className="btn btn-primary" onClick={saveUser} disabled={saving}>{saving?'...':'Enregistrer'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Inviter par email */}
      {modal?.type === 'invite' && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-header"><span className="modal-title">✉️ Inviter un utilisateur</span><button className="modal-close" onClick={() => setModal(null)}>✕</button></div>
            <div className="modal-body">
              {formErr && <div className="alert alert-error">{formErr}</div>}
              <div className="alert alert-info" style={{ fontSize:12 }}>
                L'utilisateur recevra un email pour créer son compte. Son rôle sera défini par vous.
              </div>
              <div className="grid2">
                <div className="fld"><label>Prénom</label><input value={form.prenom_invite||''} onChange={e=>set('prenom_invite',e.target.value)}/></div>
                <div className="fld"><label>Nom</label><input value={form.nom_invite||''} onChange={e=>set('nom_invite',e.target.value)}/></div>
              </div>
              <div className="fld"><label>Email *</label><input type="email" value={form.email_invite||''} onChange={e=>set('email_invite',e.target.value)}/></div>
              <div className="fld">
                <label>Rôle *</label>
                <select value={form.role_invite||''} onChange={e=>set('role_invite',e.target.value)}>
                  <option value="">Choisir un rôle</option>
                  <option value="locataire">Locataire</option>
                  {isMgr && <option value="proprietaire">Propriétaire</option>}
                  {isMgr && <option value="prestataire">Prestataire</option>}
                  {isAdmin && <option value="agence">Agence / Gestionnaire</option>}
                  {isAdmin && <option value="admin">Admin</option>}
                </select>
              </div>
              {form.role_invite === 'locataire' && biens.length > 0 && (
                <div className="fld">
                  <label>Bien à attribuer (optionnel)</label>
                  <select value={form.bien_id_invite||''} onChange={e=>set('bien_id_invite',e.target.value)}>
                    <option value="">Sans attribution immédiate</option>
                    {biens.map(b => <option key={b.id} value={b.id}>{b.adresse}, {b.ville}</option>)}
                  </select>
                </div>
              )}
              <button className="btn btn-primary" onClick={inviterParEmail} disabled={saving}>{saving?'Envoi...':'Envoyer l\'invitation'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Créer un compte directement (admin only) */}
      {modal?.type === 'create' && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-header"><span className="modal-title">+ Créer un compte directement</span><button className="modal-close" onClick={() => setModal(null)}>✕</button></div>
            <div className="modal-body">
              {formErr && <div className="alert alert-error">{formErr}</div>}
              <div className="alert alert-warn" style={{ fontSize:12 }}>
                Mot de passe provisoire : <strong>ImmoTrack2024!</strong> — À communiquer à l'utilisateur qui devra le changer.
              </div>
              <div className="grid2">
                <div className="fld"><label>Prénom *</label><input value={form.dc_prenom||''} onChange={e=>set('dc_prenom',e.target.value)}/></div>
                <div className="fld"><label>Nom *</label><input value={form.dc_nom||''} onChange={e=>set('dc_nom',e.target.value)}/></div>
              </div>
              <div className="fld"><label>Email *</label><input type="email" value={form.dc_email||''} onChange={e=>set('dc_email',e.target.value)}/></div>
              <div className="fld"><label>Téléphone</label><input value={form.dc_tel||''} onChange={e=>set('dc_tel',e.target.value)}/></div>
              <div className="fld">
                <label>Rôle *</label>
                <select value={form.dc_role||''} onChange={e=>set('dc_role',e.target.value)}>
                  <option value="">Choisir</option>
                  {Object.keys(ROLES_D).map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <button className="btn btn-primary" onClick={creerCompteDirecte} disabled={saving}>{saving?'Création...':'Créer le compte'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Assigner locataire → bien */}
      {modal?.type === 'assign_loc' && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-header"><span className="modal-title">🔗 Assigner locataire → bien</span><button className="modal-close" onClick={() => setModal(null)}>✕</button></div>
            <div className="modal-body">
              {formErr && <div className="alert alert-error">{formErr}</div>}
              <div className="fld">
                <label>Locataire *</label>
                <select value={form.a_locataire_id||''} onChange={e=>set('a_locataire_id',e.target.value)}>
                  <option value="">Choisir un locataire</option>
                  {locataires.map(u => <option key={u.id} value={u.id}>{u.prenom} {u.nom}{u.email?' ('+u.email+')':''}</option>)}
                </select>
              </div>
              <div className="fld">
                <label>Bien *</label>
                <select value={form.a_bien_id||''} onChange={e=>set('a_bien_id',e.target.value)}>
                  <option value="">Choisir un bien</option>
                  {biens.map(b => <option key={b.id} value={b.id}>{b.adresse}, {b.ville} — {b.profiles?.prenom} {b.profiles?.nom}</option>)}
                </select>
              </div>
              <div className="grid2">
                <div className="fld"><label>Loyer HC (€) *</label><input type="number" value={form.a_loyer||''} onChange={e=>set('a_loyer',e.target.value)}/></div>
                <div className="fld"><label>Date entrée *</label><input type="date" value={form.a_date||''} onChange={e=>set('a_date',e.target.value)}/></div>
              </div>
              <div className="fld">
                <label>Type contrat</label>
                <select value={form.a_contrat||''} onChange={e=>set('a_contrat',e.target.value)}>
                  <option value="">Choisir</option>
                  <option value="bail_vide">Bail vide</option><option value="bail_meuble">Bail meublé</option>
                  <option value="bail_commercial">Bail commercial</option><option value="courte_duree">Courte durée</option>
                </select>
              </div>
              <button className="btn btn-primary" onClick={assignerLocataire} disabled={saving}>{saving?'...':'Assigner'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Assigner proprio → agence */}
      {modal?.type === 'assign_prop' && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-header"><span className="modal-title">🏗️ Assigner propriétaire → agence</span><button className="modal-close" onClick={() => setModal(null)}>✕</button></div>
            <div className="modal-body">
              {formErr && <div className="alert alert-error">{formErr}</div>}
              <div className="fld">
                <label>Propriétaire *</label>
                <select value={form.ap_proprio_id||''} onChange={e=>set('ap_proprio_id',e.target.value)}>
                  <option value="">Choisir</option>
                  {proprietaires.map(u => <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>)}
                </select>
              </div>
              <div className="fld">
                <label>Agence / Gestionnaire *</label>
                <select value={form.ap_agence_id||''} onChange={e=>set('ap_agence_id',e.target.value)}>
                  <option value="">Choisir</option>
                  {agences.map(u => <option key={u.id} value={u.id}>{u.prenom} {u.nom} ({u.role})</option>)}
                </select>
              </div>
              <button className="btn btn-primary" onClick={assignerProprio} disabled={saving}>{saving?'...':'Assigner'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation suppression */}
      {confirm && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setConfirm(null)}>
          <div className="modal" style={{ maxWidth:380 }}>
            <div className="modal-header"><span className="modal-title" style={{color:'#B83232'}}>Confirmation</span><button className="modal-close" onClick={() => setConfirm(null)}>✕</button></div>
            <div className="modal-body">
              <p style={{ fontSize:14, lineHeight:1.6 }}>Supprimer <strong>{confirm.label}</strong> ? Cette action est irréversible.</p>
              {confirm.type === 'user' && <div className="alert alert-warn" style={{fontSize:12}}>Le profil sera supprimé mais le compte auth reste dans Supabase. Supprimez-le manuellement dans Authentication > Users.</div>}
              <div style={{ display:'flex', gap:8 }}>
                <button className="btn btn-secondary" style={{flex:1}} onClick={() => setConfirm(null)}>Annuler</button>
                <button className="btn btn-danger" style={{flex:1}} onClick={() => confirm.type==='user' ? deleteUser(confirm.id) : deleteAll(confirm.type)}>Supprimer</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
