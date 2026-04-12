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
  if (!MGR.includes(me?.role)) {
    return <Layout><div className="it-center"><div className="alert alert-error">Acces refuse.</div></div></Layout>
  }

  const isAdmin = me?.role === 'admin'
  const [tab,      setTab]     = useState('users')
  const [users,    setUsers]   = useState([])
  const [biens,    setBiens]   = useState([])
  const [incidents,setInc]     = useState([])
  const [loading,  setLoading] = useState(true)
  const [search,   setSearch]  = useState('')
  const [filterRole, setFilter] = useState('all')
  const [modal,    setModal]   = useState(null)
  const [form,     setForm]    = useState({})
  const [saving,   setSaving]  = useState(false)
  const [formErr,  setFormErr] = useState('')
  const [confirm,  setConfirm] = useState(null)
  const [opMsg,    setOpMsg]   = useState('')

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

  async function saveUser() {
    setSaving(true); setFormErr('')
    try {
      await supabase.from('profiles').update({
        nom: form.nom, prenom: form.prenom, role: form.role,
        telephone: form.telephone || null,
        nom_societe: form.nom_societe || null,
        notes: form.notes || null,
      }).eq('id', modal.id)
      setModal(null)
      await load()
    } catch(e) { setFormErr(e.message) }
    finally { setSaving(false) }
  }

  async function changeRole(id, role) {
    await supabase.from('profiles').update({ role }).eq('id', id)
    await load()
  }

  async function deleteUser(userId) {
    setConfirm(null)
    setOpMsg('Suppression en cours...')
    try {
      // Supprimer dans l'ordre des dépendances FK
      await supabase.from('occupants').delete().eq('location_id',
        (await supabase.from('locations').select('id').eq('locataire_id', userId)).data?.map(l=>l.id)[0] || '00000000-0000-0000-0000-000000000001'
      )
      await supabase.from('garants').delete().in('location_id',
        ((await supabase.from('locations').select('id').eq('locataire_id', userId)).data || []).map(l=>l.id)
      )
      await supabase.from('locations').delete().eq('locataire_id', userId)
      await supabase.from('incidents').delete().eq('signale_par', userId)
      await supabase.from('messages').delete().or(`expediteur.eq.${userId},destinataire.eq.${userId}`)
      await supabase.from('profiles').delete().eq('id', userId)
      setOpMsg('Profil supprime. Pour supprimer le compte auth, allez dans Supabase > Authentication > Users et supprimez le compte manuellement.')
      await load()
    } catch(e) {
      setOpMsg('Erreur : ' + e.message)
    }
  }

  async function deleteAll(type) {
    setConfirm(null)
    setOpMsg('Suppression en cours...')
    try {
      const fake = '00000000-0000-0000-0000-000000000001'
      if (type === 'all_plans') {
        await supabase.from('plan_equipements').delete().neq('id', fake)
        await supabase.from('plan_pieces').delete().neq('id', fake)
        setOpMsg('Plans supprimes.')
      } else if (type === 'all_incidents') {
        await supabase.from('incidents').delete().neq('id', fake)
        setOpMsg('Incidents supprimes.')
      } else if (type === 'all_locations') {
        await supabase.from('garants').delete().neq('id', fake)
        await supabase.from('occupants').delete().neq('id', fake)
        await supabase.from('locations').delete().neq('id', fake)
        setOpMsg('Locations supprimees.')
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
        setOpMsg('Toutes les donnees supprimees (sauf comptes admin). Supprimez les comptes non-admin dans Supabase > Authentication > Users.')
      }
      await load()
    } catch(e) {
      setOpMsg('Erreur : ' + e.message)
    }
  }

  async function exportData() {
    const [uR, bR, lR, iR] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('biens').select('*'),
      supabase.from('locations').select('*'),
      supabase.from('incidents').select('*'),
    ])
    const blob = new Blob([JSON.stringify({
      exported_at: new Date().toISOString(),
      profiles: uR.data, biens: bR.data, locations: lR.data, incidents: iR.data,
    }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `immotrack-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const rd = r => ROLES_D[r] || ROLES_D.prestataire

  const filtUsers = users.filter(u => {
    const ms = !search || `${u.prenom||''} ${u.nom||''}`.toLowerCase().includes(search.toLowerCase())
    const mr = filterRole === 'all' || u.role === filterRole
    return ms && mr
  })

  if (loading) return <Layout><div className="it-center"><div className="it-spinner"/></div></Layout>

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Administration</h1>
          <p className="page-sub">{users.length} compte(s) · {biens.length} bien(s)</p>
        </div>
        {isAdmin && <button className="btn btn-secondary" onClick={exportData}>Exporter JSON</button>}
      </div>

      {opMsg && (
        <div className={`alert ${opMsg.startsWith('Erreur') ? 'alert-error' : 'alert-success'}`}
          style={{marginBottom:16, position:'relative'}}>
          {opMsg}
          <button onClick={() => setOpMsg('')}
            style={{position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:16}}>
            ✕
          </button>
        </div>
      )}

      <div className="grid3" style={{marginBottom:16}}>
        {[['👥', users.length, 'Comptes'], ['🏢', biens.length, 'Biens'], ['⚠️', incidents.filter(i=>i.statut!=='resolu').length, 'Incidents ouverts']].map(([ic,v,l]) => (
          <div key={l} className="stat-card"><div className="stat-val">{ic} {v}</div><div className="stat-label">{l}</div></div>
        ))}
      </div>

      <div style={{display:'flex', borderBottom:'1px solid rgba(0,0,0,.08)', marginBottom:0}}>
        {[['users','Comptes'], ['biens','Biens'], ...(isAdmin ? [['incidents','Incidents'], ['tools','Outils']] : [])].map(([v,l]) => (
          <div key={v} onClick={() => setTab(v)}
            style={{padding:'10px 16px', cursor:'pointer', fontSize:13, fontWeight:500,
              color: tab===v?'#2D5A3D':'#6B6560',
              borderBottom: tab===v?'2px solid #2D5A3D':'2px solid transparent'}}>
            {l}
          </div>
        ))}
      </div>

      {/* Comptes */}
      {tab === 'users' && (
        <div className="card" style={{borderRadius:'0 0 12px 12px', borderTop:'none'}}>
          <div className="card-header">
            <span className="card-title">{filtUsers.length} compte(s)</span>
            <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
              {isAdmin && ['all','locataire','proprietaire','agence','admin','prestataire'].map(r => (
                <button key={r} className={`btn btn-xs ${filterRole===r?'btn-primary':'btn-secondary'}`}
                  onClick={() => setFilter(r)}>{r==='all'?'Tous':r}</button>
              ))}
              <input
                style={{padding:'5px 9px', border:'1px solid rgba(0,0,0,.15)', borderRadius:7, fontSize:12, outline:'none', width:150}}
                placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)}/>
            </div>
          </div>
          {filtUsers.map(u => (
            <div key={u.id} className="row-item">
              <div style={{width:34, height:34, borderRadius:'50%', background:rd(u.role).bg, color:rd(u.role).color,
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0}}>
                {rd(u.role).icon}
              </div>
              <div style={{flex:1, minWidth:0}}>
                <div style={{fontWeight:500, fontSize:13}}>{u.prenom} {u.nom}</div>
                <div style={{fontSize:10, color:'#9E9890', fontFamily:'monospace'}}>{u.id}</div>
                {u.telephone && <div style={{fontSize:11, color:'#9E9890'}}>{u.telephone}</div>}
              </div>
              {isAdmin ? (
                <select value={u.role} onChange={e => changeRole(u.id, e.target.value)}
                  style={{padding:'4px 8px', borderRadius:20, border:'none', fontFamily:'inherit', fontSize:11, fontWeight:600,
                    background:rd(u.role).bg, color:rd(u.role).color, cursor:'pointer', outline:'none'}}>
                  {Object.keys(ROLES_D).map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              ) : (
                <span style={{padding:'3px 9px', borderRadius:20, fontSize:11, fontWeight:600,
                  background:rd(u.role).bg, color:rd(u.role).color}}>{u.role}</span>
              )}
              {isAdmin && (
                <button className="btn btn-secondary btn-sm"
                  onClick={() => { setForm(u); setFormErr(''); setModal(u) }}>Modifier</button>
              )}
              {isAdmin && u.id !== me?.id && (
                <button className="btn btn-danger btn-sm"
                  onClick={() => setConfirm({type:'user', id:u.id, label:`${u.prenom} ${u.nom} (${u.role})`})}>
                  Supprimer
                </button>
              )}
            </div>
          ))}
          {filtUsers.length === 0 && <div className="card-body" style={{textAlign:'center', color:'#9E9890'}}>Aucun compte.</div>}
        </div>
      )}

      {/* Biens */}
      {tab === 'biens' && (
        <div className="card" style={{borderRadius:'0 0 12px 12px', borderTop:'none'}}>
          <div className="card-header"><span className="card-title">{biens.length} bien(s)</span></div>
          {biens.map(b => {
            const loc = b.locations?.find(l => l.statut === 'actif')
            return (
              <div key={b.id} className="row-item">
                <span style={{fontSize:20}}>🏠</span>
                <div style={{flex:1}}>
                  <div style={{fontWeight:500, fontSize:13}}>{b.adresse}, {b.ville}</div>
                  <div style={{fontSize:11, color:'#9E9890'}}>
                    Proprio : {b.profiles?.prenom} {b.profiles?.nom}
                    {loc ? ` · ${loc.profiles?.prenom||'—'} ${loc.profiles?.nom||''} · ${Number(loc.loyer_mensuel||0).toLocaleString('fr-FR')} euros` : ''}
                  </div>
                </div>
                <span className={`status ${loc?'status-green':'status-grey'}`}>{loc?'Occupe':'Vacant'}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Incidents */}
      {tab === 'incidents' && isAdmin && (
        <div className="card" style={{borderRadius:'0 0 12px 12px', borderTop:'none'}}>
          <div className="card-header"><span className="card-title">{incidents.length} incident(s)</span></div>
          {incidents.map(i => (
            <div key={i.id} className="row-item">
              <span style={{fontSize:16}}>{i.gravite==='urgent'?'🔴':i.gravite==='moyen'?'🟡':'🟢'}</span>
              <div style={{flex:1}}>
                <div style={{fontWeight:500, fontSize:13}}>{i.titre}</div>
                <div style={{fontSize:11, color:'#9E9890'}}>{i.biens?.adresse} · {i.profiles?.prenom} {i.profiles?.nom}</div>
              </div>
              <select value={i.statut}
                onChange={async e => { await supabase.from('incidents').update({statut:e.target.value}).eq('id',i.id); await load() }}
                style={{padding:'4px 8px', borderRadius:7, border:'1px solid rgba(0,0,0,.15)', fontFamily:'inherit', fontSize:11, outline:'none'}}>
                {['nouveau','en_cours','en_attente','resolu','annule'].map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}

      {/* Outils dev */}
      {tab === 'tools' && isAdmin && (
        <div className="card" style={{borderRadius:'0 0 12px 12px', borderTop:'none'}}>
          <div className="card-header"><span className="card-title">Outils de developpement</span></div>
          <div className="card-body">
            <div className="alert alert-warn" style={{marginBottom:16}}>
              Ces operations sont irreversibles. A utiliser uniquement en developpement.
            </div>

            <div className="alert alert-info" style={{marginBottom:16, fontSize:12}}>
              Note : la suppression d'un compte supprime le profil et les donnees,
              mais le compte auth.users reste dans Supabase.
              Pour le supprimer completement : Supabase Dashboard > Authentication > Users > Delete.
            </div>

            <div style={{display:'flex', flexDirection:'column', gap:10}}>
              {[
                { type:'all_plans',     label:'Supprimer tous les plans 2D',   desc:'Efface pieces et equipements de tous les plans', danger:false },
                { type:'all_incidents', label:'Supprimer tous les incidents',   desc:'Efface tous les incidents', danger:false },
                { type:'all_locations', label:'Supprimer toutes les locations', desc:'Efface locations, garants et occupants', danger:true },
                { type:'all_data',      label:'TOUT SUPPRIMER',                desc:'Efface toutes les donnees sauf les comptes admin', danger:true },
              ].map(op => (
                <div key={op.type}
                  style={{display:'flex', alignItems:'center', justifyContent:'space-between',
                    padding:'12px 14px', border:`1px solid ${op.danger?'rgba(184,50,50,.3)':'rgba(0,0,0,.08)'}`,
                    borderRadius:10, background:op.danger?'#FDEAEA':'#FAFAF8'}}>
                  <div>
                    <div style={{fontWeight:500, fontSize:13, color:op.danger?'#B83232':'#1A1714'}}>{op.label}</div>
                    <div style={{fontSize:11, color:'#9E9890'}}>{op.desc}</div>
                  </div>
                  <button className={`btn btn-sm ${op.danger?'btn-danger':'btn-secondary'}`}
                    onClick={() => setConfirm({type:op.type, label:op.label})}>
                    Supprimer
                  </button>
                </div>
              ))}
              <div style={{display:'flex', alignItems:'center', justifyContent:'space-between',
                padding:'12px 14px', border:'1px solid rgba(0,0,0,.08)', borderRadius:10, background:'#F7F5F0'}}>
                <div>
                  <div style={{fontWeight:500, fontSize:13}}>Exporter toutes les donnees</div>
                  <div style={{fontSize:11, color:'#9E9890'}}>Telecharge un fichier JSON</div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={exportData}>Exporter</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal edition */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">Modifier le profil</span>
              <button className="modal-close" onClick={() => setModal(null)}>X</button>
            </div>
            <div className="modal-body">
              {formErr && <div className="alert alert-error">{formErr}</div>}
              <div style={{fontSize:10, color:'#9E9890', fontFamily:'monospace', marginBottom:6, wordBreak:'break-all'}}>
                UUID: {modal.id}
              </div>
              <div className="grid2">
                <div className="fld"><label>Prenom</label><input value={form.prenom||''} onChange={e=>set('prenom',e.target.value)}/></div>
                <div className="fld"><label>Nom</label><input value={form.nom||''} onChange={e=>set('nom',e.target.value)}/></div>
              </div>
              <div className="grid2">
                <div className="fld"><label>Telephone</label><input value={form.telephone||''} onChange={e=>set('telephone',e.target.value)}/></div>
                <div className="fld"><label>Societe</label><input value={form.nom_societe||''} onChange={e=>set('nom_societe',e.target.value)}/></div>
              </div>
              <div className="fld">
                <label>Role</label>
                <select value={form.role||'locataire'} onChange={e=>set('role',e.target.value)}>
                  {Object.keys(ROLES_D).map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="fld"><label>Notes</label><textarea value={form.notes||''} onChange={e=>set('notes',e.target.value)}/></div>
              <button className="btn btn-primary" onClick={saveUser} disabled={saving}>
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation suppression */}
      {confirm && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setConfirm(null)}>
          <div className="modal" style={{maxWidth:380}}>
            <div className="modal-header">
              <span className="modal-title" style={{color:'#B83232'}}>Confirmation</span>
              <button className="modal-close" onClick={() => setConfirm(null)}>X</button>
            </div>
            <div className="modal-body">
              <p style={{fontSize:14, lineHeight:1.6}}>
                Supprimer <strong>{confirm.label}</strong> ?
                Cette action est irreversible.
              </p>
              {confirm.type === 'user' && (
                <div className="alert alert-warn" style={{fontSize:12}}>
                  Le profil sera supprime mais le compte auth restera dans Supabase.
                  Supprimez-le manuellement dans Supabase > Authentication > Users.
                </div>
              )}
              <div style={{display:'flex', gap:8}}>
                <button className="btn btn-secondary" style={{flex:1}} onClick={() => setConfirm(null)}>Annuler</button>
                <button className="btn btn-danger" style={{flex:1}}
                  onClick={() => confirm.type === 'user' ? deleteUser(confirm.id) : deleteAll(confirm.type)}>
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
