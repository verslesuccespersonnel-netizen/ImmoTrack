import React, { useEffect, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const ROLES = ['locataire','proprietaire','gestionnaire','prestataire']
const RC = {locataire:'#2B5EA7',proprietaire:'#2D5A3D',gestionnaire:'#C8813A',prestataire:'#6B6560'}
const RBG= {locataire:'#EBF2FC',proprietaire:'#E8F2EB',gestionnaire:'#FDF3E7',prestataire:'#F7F5F0'}

export default function Admin() {
  const { profile: me } = useAuth()
  const [tab, setTab] = useState('users')
  const [users, setUsers] = useState([])
  const [biens, setBiens] = useState([])
  const [incidents, setIncidents] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  if (!['proprietaire','gestionnaire'].includes(me?.role)) return <Layout><div className="it-center"><div className="alert alert-error">Accès refusé.</div></div></Layout>

  useEffect(()=>{ load() },[])
  async function load() {
    setLoading(true)
    const [u,b,i] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at',{ascending:false}),
      supabase.from('biens').select('*, profiles!biens_proprietaire_id_fkey(nom,prenom), locations(id,statut,loyer_mensuel)').order('created_at',{ascending:false}),
      supabase.from('incidents').select('*, biens(adresse), profiles!signale_par(nom,prenom)').order('created_at',{ascending:false}).limit(50),
    ])
    setUsers(u.data||[]); setBiens(b.data||[]); setIncidents(i.data||[])
    setLoading(false)
  }

  function set(k,v) { setForm(f=>({...f,[k]:v})) }

  async function changeRole(id, role) {
    await supabase.from('profiles').update({role}).eq('id',id)
    setUsers(us=>us.map(u=>u.id===id?{...u,role}:u))
  }

  async function saveUser() {
    setSaving(true); setError('')
    try {
      await supabase.from('profiles').update({nom:form.nom,prenom:form.prenom,role:form.role,telephone:form.telephone||null,nom_societe:form.nom_societe||null,notes:form.notes||null}).eq('id',modal.id)
      setModal(null); await load()
    } catch(e) { setError(e.message) }
    finally { setSaving(false) }
  }

  const filtUsers = users.filter(u => !search || `${u.prenom} ${u.nom}`.toLowerCase().includes(search.toLowerCase()))

  if (loading) return <Layout><div className="it-center"><div className="it-spinner"/></div></Layout>
  return (
    <Layout>
      <div className="page-header"><div><h1 className="page-title">Administration</h1></div></div>
      <div style={{ display:'flex', gap:14, marginBottom:20, flexWrap:'wrap' }}>
        {[['👥','Comptes',users.length],['🏢','Biens',biens.length],['⚠️','Incidents',incidents.filter(i=>i.statut!=='resolu').length]].map(([ic,l,v])=>
          <div key={l} className="stat-card" style={{flex:1,minWidth:120}}><div className="stat-val">{v}</div><div className="stat-label">{ic} {l}</div></div>
        )}
      </div>
      <div style={{ display:'flex', borderBottom:'1px solid rgba(0,0,0,.08)', marginBottom:0 }}>
        {[['users','👥 Comptes'],['biens','🏢 Biens'],['incidents','⚠️ Incidents']].map(([v,l])=>
          <div key={v} onClick={()=>setTab(v)} style={{ padding:'10px 16px', cursor:'pointer', fontSize:13, fontWeight:500, color:tab===v?'#2D5A3D':'#6B6560', borderBottom:tab===v?'2px solid #2D5A3D':'2px solid transparent' }}>{l}</div>
        )}
      </div>

      {tab==='users'&&<div className="card">
        <div className="card-header">
          <span className="card-title">Comptes ({filtUsers.length})</span>
          <input style={{padding:'6px 11px',border:'1px solid rgba(0,0,0,.15)',borderRadius:8,fontSize:12,outline:'none',width:180}} placeholder="Rechercher…" value={search} onChange={e=>setSearch(e.target.value)} />
        </div>
        {filtUsers.map(u=>(
          <div key={u.id} className="row-item">
            <div style={{width:34,height:34,borderRadius:'50%',background:RBG[u.role]||'#F7F5F0',color:RC[u.role]||'#6B6560',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,flexShrink:0}}>{u.prenom?.[0]||'?'}{u.nom?.[0]||''}</div>
            <div style={{flex:1,minWidth:0}}><div style={{fontWeight:500,fontSize:13}}>{u.prenom} {u.nom}</div><div style={{fontSize:11,color:'#9E9890',fontFamily:'monospace'}}>{u.id.slice(0,12)}…</div></div>
            <select value={u.role} onChange={e=>changeRole(u.id,e.target.value)} style={{padding:'4px 8px',borderRadius:20,border:'none',fontFamily:'inherit',fontSize:11,fontWeight:600,background:RBG[u.role]||'#F7F5F0',color:RC[u.role]||'#6B6560',cursor:'pointer',outline:'none'}}>
              {ROLES.map(r=><option key={r} value={r}>{r}</option>)}
            </select>
            <button className="btn btn-secondary btn-sm" onClick={()=>{setForm(u);setError('');setModal(u)}}>✏️</button>
          </div>
        ))}
      </div>}

      {tab==='biens'&&<div className="card">
        <div className="card-header"><span className="card-title">Biens ({biens.length})</span></div>
        {biens.map(b=>{const loc=b.locations?.find(l=>l.statut==='actif');return(
          <div key={b.id} className="row-item">
            <span style={{fontSize:20}}>🏠</span>
            <div style={{flex:1}}><div style={{fontWeight:500,fontSize:13}}>{b.adresse}, {b.ville}</div><div style={{fontSize:11,color:'#9E9890'}}>Propriétaire : {b.profiles?.prenom} {b.profiles?.nom}{loc?` · ${Number(loc.loyer_mensuel).toLocaleString('fr-FR')} €/mois`:''}</div></div>
            <span className={`status ${loc?'status-green':'status-grey'}`}>{loc?'Occupé':'Vacant'}</span>
          </div>
        )})}
      </div>}

      {tab==='incidents'&&<div className="card">
        <div className="card-header"><span className="card-title">Incidents ({incidents.length})</span></div>
        {incidents.map(i=>(
          <div key={i.id} className="row-item">
            <span style={{fontSize:16}}>{i.gravite==='urgent'?'🔴':i.gravite==='moyen'?'🟡':'🟢'}</span>
            <div style={{flex:1}}><div style={{fontWeight:500,fontSize:13}}>{i.titre}</div><div style={{fontSize:11,color:'#9E9890'}}>{i.biens?.adresse} · {i.profiles?.prenom} {i.profiles?.nom}</div></div>
            <select value={i.statut} onChange={async e=>{await supabase.from('incidents').update({statut:e.target.value}).eq('id',i.id);await load()}} style={{padding:'4px 8px',borderRadius:8,border:'1px solid rgba(0,0,0,.15)',fontFamily:'inherit',fontSize:11,outline:'none',cursor:'pointer'}}>
              {['nouveau','en_cours','en_attente','resolu','annule'].map(s=><option key={s} value={s}>{s.replace('_',' ')}</option>)}
            </select>
          </div>
        ))}
      </div>}

      {modal&&(
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div className="modal"><div className="modal-header"><span className="modal-title">Modifier le profil</span><button className="modal-close" onClick={()=>setModal(null)}>✕</button></div>
          <div className="modal-body">
            {error&&<div className="alert alert-error">{error}</div>}
            <div style={{fontSize:10,color:'#9E9890',fontFamily:'monospace',marginBottom:4}}>UUID: {modal.id}</div>
            <div className="grid2"><div className="fld"><label>Prénom</label><input value={form.prenom||''} onChange={e=>set('prenom',e.target.value)}/></div><div className="fld"><label>Nom</label><input value={form.nom||''} onChange={e=>set('nom',e.target.value)}/></div></div>
            <div className="grid2"><div className="fld"><label>Téléphone</label><input value={form.telephone||''} onChange={e=>set('telephone',e.target.value)}/></div><div className="fld"><label>Société</label><input value={form.nom_societe||''} onChange={e=>set('nom_societe',e.target.value)}/></div></div>
            <div className="fld"><label>Rôle</label><select value={form.role||'locataire'} onChange={e=>set('role',e.target.value)}>{ROLES.map(r=><option key={r} value={r}>{r}</option>)}</select></div>
            <div className="fld"><label>Notes</label><textarea value={form.notes||''} onChange={e=>set('notes',e.target.value)}/></div>
            <button className="btn btn-primary" onClick={saveUser} disabled={saving}>{saving?'…':'💾 Enregistrer'}</button>
          </div></div>
        </div>
      )}
    </Layout>
  )
}
