import React, { useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { useLoad } from '../lib/useLoad'
import Layout from '../components/Layout'

const ROLES_D = {
  locataire:    { color:'#2B5EA7', bg:'#EBF2FC', icon:'🏠' },
  proprietaire: { color:'#2D5A3D', bg:'#E8F2EB', icon:'🏢' },
  agence:       { color:'#C8813A', bg:'#FDF3E7', icon:'🏗️' },
  admin:        { color:'#B83232', bg:'#FDEAEA', icon:'⚙️' },
  prestataire:  { color:'#6B6560', bg:'#F7F5F0', icon:'🔧' },
  gestionnaire: { color:'#C8813A', bg:'#FDF3E7', icon:'🏗️' },
}

export default function Admin() {
  const { profile: me } = useAuth()
  const MGR = ['proprietaire','gestionnaire','agence','admin']
  if (!MGR.includes(me?.role)) return <Layout><div className="it-center"><div className="alert alert-error">⛔ Accès refusé.</div></div></Layout>

  const isAdmin = me?.role === 'admin'
  const [tab, setTab]     = useState('users')
  const [search, setSearch] = useState('')
  const [filterRole, setFilter] = useState('all')
  const [modal, setModal] = useState(null)
  const [form, setForm]   = useState({})
  const [saving, setSaving] = useState(false)
  const [formErr, setFormErr] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)

  const { data, loading, error, reload } = useLoad(async () => {
    const [usersRes, biensRes, incRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at',{ascending:false}),
      supabase.from('biens').select('*,profiles!biens_proprietaire_id_fkey(nom,prenom),locations(id,statut,loyer_mensuel,profiles!locataire_id(nom,prenom))').order('created_at',{ascending:false}),
      isAdmin ? supabase.from('incidents').select('*,biens(adresse),profiles!signale_par(nom,prenom)').order('created_at',{ascending:false}).limit(50) : Promise.resolve({data:[]}),
    ])
    return { users: usersRes.data||[], biens: biensRes.data||[], incidents: incRes.data||[] }
  }, [me?.id])

  function set(k,v){setForm(f=>({...f,[k]:v}))}

  async function saveUser() {
    setSaving(true); setFormErr('')
    try {
      await supabase.from('profiles').update({ nom:form.nom, prenom:form.prenom, role:form.role, telephone:form.telephone||null, nom_societe:form.nom_societe||null, notes:form.notes||null }).eq('id',modal.id)
      setModal(null); reload()
    } catch(e) { setFormErr(e.message) }
    finally { setSaving(false) }
  }

  async function changeRole(id, role) {
    await supabase.from('profiles').update({ role }).eq('id',id)
    reload()
  }

  // ── Suppression sélective ──────────────────────────────
  async function deleteSelected(type, id) {
    setConfirmDelete(null)
    if (type === 'user') {
      await supabase.from('profiles').delete().eq('id', id)
    } else if (type === 'bien') {
      await supabase.from('biens').delete().eq('id', id)
    } else if (type === 'all_plans') {
      await supabase.from('plan_equipements').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('plan_pieces').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    } else if (type === 'all_locations') {
      await supabase.from('garants').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('occupants').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('locations').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    } else if (type === 'all_incidents') {
      await supabase.from('incidents').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    } else if (type === 'all_data') {
      // Tout supprimer dans l'ordre (FK)
      await supabase.from('plan_equipements').delete().neq('id','00000000-0000-0000-0000-000000000000')
      await supabase.from('plan_pieces').delete().neq('id','00000000-0000-0000-0000-000000000000')
      await supabase.from('garants').delete().neq('id','00000000-0000-0000-0000-000000000000')
      await supabase.from('occupants').delete().neq('id','00000000-0000-0000-0000-000000000000')
      await supabase.from('incidents').delete().neq('id','00000000-0000-0000-0000-000000000000')
      await supabase.from('messages').delete().neq('id','00000000-0000-0000-0000-000000000000')
      await supabase.from('documents').delete().neq('id','00000000-0000-0000-0000-000000000000')
      await supabase.from('locations').delete().neq('id','00000000-0000-0000-0000-000000000000')
      await supabase.from('biens').delete().neq('id','00000000-0000-0000-0000-000000000000')
      // Garder les profils admin
      await supabase.from('profiles').delete().neq('role','admin')
    }
    reload()
  }

  // ── Export JSON ────────────────────────────────────────
  async function exportData() {
    const [usersR,biensR,locsR,incR] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('biens').select('*'),
      supabase.from('locations').select('*'),
      supabase.from('incidents').select('*'),
    ])
    const blob = new Blob([JSON.stringify({
      exported_at: new Date().toISOString(),
      profiles: usersR.data, biens: biensR.data,
      locations: locsR.data, incidents: incR.data,
    }, null, 2)], { type:'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `immotrack-export-${new Date().toISOString().split('T')[0]}.json`
    a.click(); URL.revokeObjectURL(url)
  }

  const users = data?.users || []
  const biens = data?.biens || []
  const incidents = data?.incidents || []
  const filtUsers = users.filter(u => {
    const ms = !search || `${u.prenom||''} ${u.nom||''}`.toLowerCase().includes(search.toLowerCase())
    const mr = filterRole==='all' || u.role===filterRole
    return ms && mr
  })

  if (loading) return <Layout><div className="it-center"><div className="it-spinner"/></div></Layout>
  if (error)   return <Layout><div className="it-center"><div className="alert alert-error">{error}</div></div></Layout>

  const rd = r => ROLES_D[r] || ROLES_D.prestataire
  const TABS = [['users','👥 Comptes'],['biens','🏢 Biens'],..  (isAdmin?[['incidents','⚠️ Incidents'],['tools','🛠️ Outils']]:[])]

  return (
    <Layout>
      <div className="page-header">
        <div><h1 className="page-title">Administration</h1><p className="page-sub">{users.length} compte(s) · {biens.length} bien(s)</p></div>
        {isAdmin && <button className="btn btn-secondary" onClick={exportData}>⬇️ Exporter JSON</button>}
      </div>

      <div style={{display:'flex',gap:14,marginBottom:16,flexWrap:'wrap'}}>
        {[['👥',users.length,'Comptes'],['🏢',biens.length,'Biens'],['⚠️',incidents.filter(i=>i.statut!=='resolu').length,'Incidents ouverts']].map(([ic,v,l])=>(
          <div key={l} className="stat-card" style={{flex:1,minWidth:120}}><div className="stat-val">{ic} {v}</div><div className="stat-label">{l}</div></div>
        ))}
      </div>

      <div style={{display:'flex',borderBottom:'1px solid rgba(0,0,0,.08)',marginBottom:0}}>
        {[['users','👥 Comptes'],['biens','🏢 Biens'],...(isAdmin?[['incidents','⚠️ Incidents'],['tools','🛠️ Outils']]:[])]
          .map(([v,l])=>(
            <div key={v} onClick={()=>setTab(v)} style={{padding:'10px 16px',cursor:'pointer',fontSize:13,fontWeight:500,color:tab===v?'#2D5A3D':'#6B6560',borderBottom:tab===v?'2px solid #2D5A3D':'2px solid transparent'}}>{l}</div>
          ))
        }
      </div>

      {tab==='users' && (
        <div className="card" style={{borderRadius:'0 0 12px 12px',borderTop:'none'}}>
          <div className="card-header">
            <span className="card-title">{filtUsers.length} compte(s)</span>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {isAdmin && ['all','locataire','proprietaire','agence','admin','prestataire'].map(r=>(
                <button key={r} className={`btn btn-xs ${filterRole===r?'btn-primary':'btn-secondary'}`} onClick={()=>setFilter(r)}>{r==='all'?'Tous':r}</button>
              ))}
              <input style={{padding:'5px 9px',border:'1px solid rgba(0,0,0,.15)',borderRadius:7,fontSize:12,outline:'none',width:150}} placeholder="Rechercher…" value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
          </div>
          {filtUsers.map(u=>(
            <div key={u.id} className="row-item">
              <div style={{width:34,height:34,borderRadius:'50%',background:rd(u.role).bg,color:rd(u.role).color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>{rd(u.role).icon}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:500,fontSize:13}}>{u.prenom} {u.nom}</div>
                <div style={{fontSize:10,color:'#9E9890',fontFamily:'monospace'}}>{u.id.slice(0,16)}…{u.telephone?` · ${u.telephone}`:''}</div>
              </div>
              {isAdmin ? (
                <select value={u.role} onChange={e=>changeRole(u.id,e.target.value)} style={{padding:'4px 8px',borderRadius:20,border:'none',fontFamily:'inherit',fontSize:11,fontWeight:600,background:rd(u.role).bg,color:rd(u.role).color,cursor:'pointer',outline:'none'}}>
                  {Object.keys(ROLES_D).map(r=><option key={r} value={r}>{r}</option>)}
                </select>
              ) : (
                <span style={{padding:'3px 9px',borderRadius:20,fontSize:11,fontWeight:600,background:rd(u.role).bg,color:rd(u.role).color}}>{u.role}</span>
              )}
              {isAdmin && <button className="btn btn-secondary btn-sm" onClick={()=>{setForm(u);setFormErr('');setModal(u)}}>✏️</button>}
              {isAdmin && u.id!==me?.id && <button className="btn btn-danger btn-sm" onClick={()=>setConfirmDelete({type:'user',id:u.id,label:`le compte ${u.prenom} ${u.nom}`})}>🗑️</button>}
            </div>
          ))}
          {filtUsers.length===0&&<div className="card-body" style={{textAlign:'center',color:'#9E9890'}}>Aucun résultat.</div>}
        </div>
      )}

      {tab==='biens' && (
        <div className="card" style={{borderRadius:'0 0 12px 12px',borderTop:'none'}}>
          <div className="card-header"><span className="card-title">{biens.length} bien(s)</span></div>
          {biens.map(b=>{const loc=b.locations?.find(l=>l.statut==='actif');return(
            <div key={b.id} className="row-item">
              <span style={{fontSize:20}}>🏠</span>
              <div style={{flex:1}}><div style={{fontWeight:500,fontSize:13}}>{b.adresse}, {b.ville}</div><div style={{fontSize:11,color:'#9E9890'}}>Proprio : {b.profiles?.prenom} {b.profiles?.nom}{loc?` · ${loc.profiles?.prenom||'—'} ${loc.profiles?.nom||''} · ${Number(loc.loyer_mensuel||0).toLocaleString('fr-FR')} €`:''}</div></div>
              <span className={`status ${loc?'status-green':'status-grey'}`}>{loc?'Occupé':'Vacant'}</span>
              {isAdmin && <button className="btn btn-danger btn-sm" onClick={()=>setConfirmDelete({type:'bien',id:b.id,label:`le bien ${b.adresse}`})}>🗑️</button>}
            </div>
          )})}
        </div>
      )}

      {tab==='incidents' && isAdmin && (
        <div className="card" style={{borderRadius:'0 0 12px 12px',borderTop:'none'}}>
          <div className="card-header"><span className="card-title">{incidents.length} incident(s)</span></div>
          {incidents.map(i=>(
            <div key={i.id} className="row-item">
              <span style={{fontSize:16}}>{i.gravite==='urgent'?'🔴':i.gravite==='moyen'?'🟡':'🟢'}</span>
              <div style={{flex:1}}><div style={{fontWeight:500,fontSize:13}}>{i.titre}</div><div style={{fontSize:11,color:'#9E9890'}}>{i.biens?.adresse} · {i.profiles?.prenom} {i.profiles?.nom}</div></div>
              <select value={i.statut} onChange={async e=>{await supabase.from('incidents').update({statut:e.target.value}).eq('id',i.id);reload()}} style={{padding:'4px 8px',borderRadius:7,border:'1px solid rgba(0,0,0,.15)',fontFamily:'inherit',fontSize:11,outline:'none'}}>
                {['nouveau','en_cours','en_attente','resolu','annule'].map(s=><option key={s} value={s}>{s.replace('_',' ')}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}

      {tab==='tools' && isAdmin && (
        <div className="card" style={{borderRadius:'0 0 12px 12px',borderTop:'none'}}>
          <div className="card-header"><span className="card-title">🛠️ Outils de développement</span></div>
          <div className="card-body">
            <div className="alert alert-warn" style={{marginBottom:16}}>
              ⚠️ Ces opérations sont <strong>irréversibles</strong>. Utilisez uniquement en développement.
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {[
                { type:'all_plans', label:'🗺️ Supprimer tous les plans 2D', desc:'Efface toutes les pièces et équipements des plans' },
                { type:'all_incidents', label:'⚠️ Supprimer tous les incidents', desc:'Efface tous les incidents et leurs médias' },
                { type:'all_locations', label:'👥 Supprimer toutes les locations', desc:'Efface locations, occupants et garants' },
                { type:'all_data', label:'💣 TOUT SUPPRIMER', desc:'Efface toutes les données sauf les comptes admin', danger:true },
              ].map(op=>(
                <div key={op.type} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 14px',border:`1px solid ${op.danger?'rgba(184,50,50,.3)':'rgba(0,0,0,.08)'}`,borderRadius:10,background:op.danger?'#FDEAEA':'#FAFAF8'}}>
                  <div>
                    <div style={{fontWeight:500,fontSize:13,color:op.danger?'#B83232':'#1A1714'}}>{op.label}</div>
                    <div style={{fontSize:11,color:'#9E9890'}}>{op.desc}</div>
                  </div>
                  <button className={`btn btn-sm ${op.danger?'btn-danger':'btn-secondary'}`} onClick={()=>setConfirmDelete({type:op.type,label:op.label})}>
                    Supprimer
                  </button>
                </div>
              ))}
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 14px',border:'1px solid rgba(0,0,0,.08)',borderRadius:10,background:'#F7F5F0'}}>
                <div>
                  <div style={{fontWeight:500,fontSize:13}}>⬇️ Exporter toutes les données</div>
                  <div style={{fontSize:11,color:'#9E9890'}}>Télécharge un fichier JSON avec toutes les données</div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={exportData}>Exporter</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal édition user */}
      {modal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div className="modal">
            <div className="modal-header"><span className="modal-title">Modifier le profil</span><button className="modal-close" onClick={()=>setModal(null)}>✕</button></div>
            <div className="modal-body">
              {formErr&&<div className="alert alert-error">{formErr}</div>}
              <div style={{fontSize:10,color:'#9E9890',fontFamily:'monospace',marginBottom:6}}>UUID: {modal.id}</div>
              <div className="grid2"><div className="fld"><label>Prénom</label><input value={form.prenom||''} onChange={e=>set('prenom',e.target.value)}/></div><div className="fld"><label>Nom</label><input value={form.nom||''} onChange={e=>set('nom',e.target.value)}/></div></div>
              <div className="grid2"><div className="fld"><label>Téléphone</label><input value={form.telephone||''} onChange={e=>set('telephone',e.target.value)}/></div><div className="fld"><label>Société</label><input value={form.nom_societe||''} onChange={e=>set('nom_societe',e.target.value)}/></div></div>
              <div className="fld"><label>Rôle</label><select value={form.role||'locataire'} onChange={e=>set('role',e.target.value)}>{Object.keys(ROLES_D).map(r=><option key={r} value={r}>{r}</option>)}</select></div>
              <div className="fld"><label>Notes</label><textarea value={form.notes||''} onChange={e=>set('notes',e.target.value)}/></div>
              <button className="btn btn-primary" onClick={saveUser} disabled={saving}>{saving?'…':'💾 Enregistrer'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation suppression */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setConfirmDelete(null)}>
          <div className="modal" style={{maxWidth:360}}>
            <div className="modal-header"><span className="modal-title" style={{color:'#B83232'}}>⚠️ Confirmation</span><button className="modal-close" onClick={()=>setConfirmDelete(null)}>✕</button></div>
            <div className="modal-body">
              <p style={{fontSize:14,lineHeight:1.6}}>Êtes-vous sûr de vouloir supprimer <strong>{confirmDelete.label}</strong> ? Cette action est irréversible.</p>
              <div style={{display:'flex',gap:8}}>
                <button className="btn btn-secondary" style={{flex:1}} onClick={()=>setConfirmDelete(null)}>Annuler</button>
                <button className="btn btn-danger" style={{flex:1}} onClick={()=>deleteSelected(confirmDelete.type,confirmDelete.id)}>Supprimer</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
