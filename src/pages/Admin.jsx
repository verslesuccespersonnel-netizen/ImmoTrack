import React, { useEffect, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const ROLES_DISPLAY = {
  locataire:    { color:'#2B5EA7', bg:'#EBF2FC', icon:'🏠' },
  proprietaire: { color:'#2D5A3D', bg:'#E8F2EB', icon:'🏢' },
  agence:       { color:'#C8813A', bg:'#FDF3E7', icon:'🏗️' },
  admin:        { color:'#B83232', bg:'#FDEAEA', icon:'⚙️' },
  prestataire:  { color:'#6B6560', bg:'#F7F5F0', icon:'🔧' },
  gestionnaire: { color:'#C8813A', bg:'#FDF3E7', icon:'🏗️' },
}

export default function Admin() {
  const { profile: me } = useAuth()
  const [tab, setTab]         = useState('users')
  const [users, setUsers]     = useState([])
  const [biens, setBiens]     = useState([])
  const [incidents, setInc]   = useState([])
  const [agenceLiens, setLiens] = useState([]) // liens agence ↔ propriétaire
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [filterRole, setFilter] = useState('all')
  const [modal, setModal]     = useState(null)
  const [form, setForm]       = useState({})
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  const isAdmin = me?.role === 'admin'
  const isAgence = me?.role === 'agence'
  const MGR = ['proprietaire','gestionnaire','agence','admin']
  if (!MGR.includes(me?.role)) {
    return <Layout><div className="it-center"><div className="alert alert-error">⛔ Accès refusé.</div></div></Layout>
  }

  useEffect(() => { load() }, [me])

  async function load() {
    setLoading(true)
    try {
      if (isAdmin) {
        // Admin voit tout
        const [u, b, i] = await Promise.all([
          supabase.from('profiles').select('*').order('created_at', { ascending:false }),
          supabase.from('biens').select('*, profiles!biens_proprietaire_id_fkey(nom,prenom,role), locations(id,statut,loyer_mensuel)').order('created_at', { ascending:false }),
          supabase.from('incidents').select('*, biens(adresse), profiles!signale_par(nom,prenom)').order('created_at', { ascending:false }).limit(50),
        ])
        setUsers(u.data||[])
        setBiens(b.data||[])
        setInc(i.data||[])
      } else if (isAgence) {
        // Agence voit ses propriétaires liés + leurs locataires
        const [liensRes, biensRes] = await Promise.all([
          supabase.from('agence_proprietaires').select('*, proprietaire:profiles!proprietaire_id(id,nom,prenom,telephone)').eq('agence_id', me.id),
          supabase.from('biens').select('*, profiles!biens_proprietaire_id_fkey(nom,prenom), locations(id,statut,loyer_mensuel,profiles!locataire_id(id,nom,prenom))').in('proprietaire_id', await getPropIds()),
        ])
        setLiens(liensRes.data||[])
        setBiens(biensRes.data||[])
        // Récupérer les locataires des biens de l'agence
        const locIds = (biensRes.data||[]).flatMap(b => (b.locations||[]).map(l => l.locataire_id)).filter(Boolean)
        if (locIds.length > 0) {
          const { data: locs } = await supabase.from('profiles').select('*').in('id', [...new Set(locIds)])
          setUsers(locs||[])
        }
      } else {
        // Propriétaire : ses biens + ses locataires seulement
        const { data: biensData } = await supabase.from('biens')
          .select('*, locations(id,statut,loyer_mensuel,profiles!locataire_id(id,nom,prenom,telephone))')
          .eq('proprietaire_id', me.id)
        setBiens(biensData||[])
        const locIds = (biensData||[]).flatMap(b => (b.locations||[]).map(l => l.locataire_id)).filter(Boolean)
        if (locIds.length > 0) {
          const { data: locs } = await supabase.from('profiles').select('*').in('id', [...new Set(locIds)])
          setUsers(locs||[])
        }
      }
    } catch(e) {
      console.error('Admin load:', e.message)
    }
    setLoading(false)
  }

  async function getPropIds() {
    const { data } = await supabase.from('agence_proprietaires').select('proprietaire_id').eq('agence_id', me.id)
    return (data||[]).map(r => r.proprietaire_id)
  }

  async function addPropToAgence() {
    if (!form.prop_email) { setError('Email obligatoire'); return }
    setSaving(true); setError('')
    try {
      // Chercher le propriétaire par email (via auth)
      const { data: prof } = await supabase.from('profiles').select('id,nom,prenom,role').eq('role','proprietaire')
      // Note: on ne peut pas chercher par email sans service_role
      // On demande l'UUID directement
      if (!form.prop_uuid) { setError('Entrez l\'UUID du propriétaire (visible dans Administration → Comptes)'); setSaving(false); return }
      await supabase.from('agence_proprietaires').insert({ agence_id: me.id, proprietaire_id: form.prop_uuid })
      setModal(null); await load()
    } catch(e) { setError(e.message) }
    finally { setSaving(false) }
  }

  async function removePropFromAgence(propId) {
    if (!window.confirm('Retirer ce propriétaire de votre agence ?')) return
    await supabase.from('agence_proprietaires').delete().eq('agence_id', me.id).eq('proprietaire_id', propId)
    await load()
  }

  function set(k,v) { setForm(f=>({...f,[k]:v})) }

  async function saveUser() {
    if (!isAdmin) return
    setSaving(true); setError('')
    try {
      await supabase.from('profiles').update({
        nom:form.nom, prenom:form.prenom, role:form.role,
        telephone:form.telephone||null, nom_societe:form.nom_societe||null, notes:form.notes||null,
      }).eq('id', modal.id)
      setModal(null); await load()
    } catch(e) { setError(e.message) }
    finally { setSaving(false) }
  }

  async function changeRole(id, role) {
    if (!isAdmin) return
    await supabase.from('profiles').update({ role }).eq('id', id)
    setUsers(u => u.map(x => x.id===id ? {...x,role} : x))
  }

  const filtUsers = users.filter(u => {
    const matchSearch = !search || `${u.prenom||''} ${u.nom||''}`.toLowerCase().includes(search.toLowerCase())
    const matchRole   = filterRole==='all' || u.role===filterRole
    return matchSearch && matchRole
  })

  if (loading) return <Layout><div className="it-center"><div className="it-spinner"/></div></Layout>

  const rd = (role) => ROLES_DISPLAY[role] || ROLES_DISPLAY.prestataire

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Administration</h1>
          <p className="page-sub">{isAdmin ? 'Vue globale — tous les comptes' : isAgence ? `Agence — ${agenceLiens.length} propriétaire(s) liés` : 'Vos locataires'}</p>
        </div>
        {isAgence && (
          <button className="btn btn-primary" onClick={() => { setForm({}); setError(''); setModal({ type:'add_prop' }) }}>
            + Lier un propriétaire
          </button>
        )}
      </div>

      {/* Stats rapides */}
      <div className="grid3" style={{ marginBottom:20 }}>
        {[
          { icon:'👥', label: isAdmin?'Comptes':'Locataires', val: users.length },
          { icon:'🏢', label:'Biens', val: biens.length },
          { icon:'⚠️', label:'Incidents ouverts', val: incidents.filter(i=>i.statut!=='resolu').length },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-val">{s.icon} {s.val}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:'1px solid rgba(0,0,0,.08)', marginBottom:0 }}>
        {[
          ['users', isAdmin ? '👥 Comptes' : '👥 Locataires'],
          ...(isAgence ? [['agence', '🏗️ Mes propriétaires']] : []),
          ['biens', '🏢 Biens'],
          ...(isAdmin ? [['incidents', '⚠️ Incidents']] : []),
        ].map(([v,l]) => (
          <div key={v} onClick={() => setTab(v)}
            style={{ padding:'10px 16px', cursor:'pointer', fontSize:13, fontWeight:500,
              color: tab===v?'#2D5A3D':'#6B6560',
              borderBottom: tab===v?'2px solid #2D5A3D':'2px solid transparent' }}>{l}</div>
        ))}
      </div>

      {/* ── Comptes ── */}
      {tab==='users' && (
        <div className="card" style={{ marginTop:0, borderRadius:'0 0 12px 12px', borderTop:'none' }}>
          <div className="card-header">
            <span className="card-title">{filtUsers.length} compte(s)</span>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {isAdmin && (
                <div style={{ display:'flex', gap:4 }}>
                  {['all','locataire','proprietaire','agence','admin'].map(r => (
                    <button key={r} className={`btn btn-xs ${filterRole===r?'btn-primary':'btn-secondary'}`}
                      onClick={() => setFilter(r)}>
                      {r==='all'?'Tous':r}
                    </button>
                  ))}
                </div>
              )}
              <input style={{ padding:'6px 10px', border:'1px solid rgba(0,0,0,.15)', borderRadius:7, fontSize:12, outline:'none', width:160 }}
                placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)} />
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
                  {u.telephone && `${u.telephone} · `}
                  <span style={{ fontFamily:'monospace' }}>{u.id.slice(0,12)}…</span>
                </div>
              </div>
              {isAdmin ? (
                <select value={u.role} onChange={e => changeRole(u.id, e.target.value)}
                  style={{ padding:'4px 8px', borderRadius:20, border:'none', fontFamily:'inherit', fontSize:11, fontWeight:600, background:rd(u.role).bg, color:rd(u.role).color, cursor:'pointer', outline:'none' }}>
                  {Object.keys(ROLES_DISPLAY).map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              ) : (
                <span style={{ padding:'3px 9px', borderRadius:20, fontSize:11, fontWeight:600, background:rd(u.role).bg, color:rd(u.role).color }}>{u.role}</span>
              )}
              {isAdmin && (
                <button className="btn btn-secondary btn-sm" onClick={() => { setForm(u); setError(''); setModal({ type:'edit_user', ...u }) }}>✏️</button>
              )}
            </div>
          ))}
          {filtUsers.length === 0 && <div className="card-body" style={{ textAlign:'center', color:'#9E9890' }}>Aucun compte trouvé.</div>}
        </div>
      )}

      {/* ── Mes propriétaires (agence) ── */}
      {tab==='agence' && isAgence && (
        <div className="card" style={{ marginTop:0, borderRadius:'0 0 12px 12px', borderTop:'none' }}>
          <div className="card-header"><span className="card-title">{agenceLiens.length} propriétaire(s) liés</span></div>
          {agenceLiens.map(l => (
            <div key={l.id} className="row-item">
              <div style={{ fontSize:20 }}>🏢</div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:500, fontSize:13 }}>{l.proprietaire?.prenom} {l.proprietaire?.nom}</div>
                {l.proprietaire?.telephone && <div style={{ fontSize:11, color:'#9E9890' }}>{l.proprietaire.telephone}</div>}
              </div>
              <button className="btn btn-danger btn-sm" onClick={() => removePropFromAgence(l.proprietaire_id)}>Retirer</button>
            </div>
          ))}
          {agenceLiens.length === 0 && <div className="card-body" style={{ textAlign:'center', color:'#9E9890' }}>Aucun propriétaire lié. Ajoutez des propriétaires à gérer.</div>}
        </div>
      )}

      {/* ── Biens ── */}
      {tab==='biens' && (
        <div className="card" style={{ marginTop:0, borderRadius:'0 0 12px 12px', borderTop:'none' }}>
          <div className="card-header"><span className="card-title">{biens.length} bien(s)</span></div>
          {biens.map(b => {
            const loc = b.locations?.find(l => l.statut==='actif')
            return (
              <div key={b.id} className="row-item">
                <span style={{ fontSize:20 }}>🏠</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:500, fontSize:13 }}>{b.adresse}, {b.ville}</div>
                  <div style={{ fontSize:11, color:'#9E9890' }}>
                    Propriétaire : {b.profiles?.prenom} {b.profiles?.nom}
                    {loc ? ` · Locataire : ${loc.profiles?.prenom||'—'} ${loc.profiles?.nom||''} · ${Number(loc.loyer_mensuel).toLocaleString('fr-FR')} €` : ''}
                  </div>
                </div>
                <span className={`status ${loc?'status-green':'status-grey'}`}>{loc?'Occupé':'Vacant'}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Incidents (admin) ── */}
      {tab==='incidents' && isAdmin && (
        <div className="card" style={{ marginTop:0, borderRadius:'0 0 12px 12px', borderTop:'none' }}>
          <div className="card-header"><span className="card-title">{incidents.length} incident(s)</span></div>
          {incidents.map(i => (
            <div key={i.id} className="row-item">
              <span style={{ fontSize:16 }}>{i.gravite==='urgent'?'🔴':i.gravite==='moyen'?'🟡':'🟢'}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:500, fontSize:13 }}>{i.titre}</div>
                <div style={{ fontSize:11, color:'#9E9890' }}>{i.biens?.adresse} · {i.profiles?.prenom} {i.profiles?.nom}</div>
              </div>
              <select value={i.statut} onChange={async e => { await supabase.from('incidents').update({statut:e.target.value}).eq('id',i.id); await load() }}
                style={{ padding:'4px 8px', borderRadius:7, border:'1px solid rgba(0,0,0,.15)', fontFamily:'inherit', fontSize:11, outline:'none' }}>
                {['nouveau','en_cours','en_attente','resolu','annule'].map(s=><option key={s} value={s}>{s.replace('_',' ')}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}

      {/* ── Modals ── */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">
                {modal.type==='edit_user' ? 'Modifier le profil'
                  : modal.type==='add_prop' ? 'Lier un propriétaire'
                  : ''}
              </span>
              <button className="modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error">{error}</div>}

              {modal.type==='edit_user' && <>
                <div style={{ fontSize:10, color:'#9E9890', fontFamily:'monospace', marginBottom:6 }}>UUID: {modal.id}</div>
                <div className="grid2">
                  <div className="fld"><label>Prénom</label><input value={form.prenom||''} onChange={e=>set('prenom',e.target.value)} /></div>
                  <div className="fld"><label>Nom</label><input value={form.nom||''} onChange={e=>set('nom',e.target.value)} /></div>
                </div>
                <div className="grid2">
                  <div className="fld"><label>Téléphone</label><input value={form.telephone||''} onChange={e=>set('telephone',e.target.value)} /></div>
                  <div className="fld"><label>Société</label><input value={form.nom_societe||''} onChange={e=>set('nom_societe',e.target.value)} /></div>
                </div>
                <div className="fld"><label>Rôle</label>
                  <select value={form.role||'locataire'} onChange={e=>set('role',e.target.value)}>
                    {Object.keys(ROLES_DISPLAY).map(r=><option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="fld"><label>Notes</label><textarea value={form.notes||''} onChange={e=>set('notes',e.target.value)} /></div>
                <button className="btn btn-primary" onClick={saveUser} disabled={saving}>{saving?'…':'💾 Enregistrer'}</button>
              </>}

              {modal.type==='add_prop' && <>
                <div className="alert alert-info">
                  Pour lier un propriétaire, demandez-lui son UUID (visible dans son espace → Administration → Comptes → son identifiant).
                </div>
                <div className="fld"><label>UUID du propriétaire *</label><input value={form.prop_uuid||''} onChange={e=>set('prop_uuid',e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" /></div>
                <button className="btn btn-primary" onClick={addPropToAgence} disabled={saving}>{saving?'…':'🔗 Lier'}</button>
              </>}
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
