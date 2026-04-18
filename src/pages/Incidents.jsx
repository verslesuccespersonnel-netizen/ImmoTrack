import React, { useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { useLoad } from '../lib/useLoad'
import Layout from '../components/Layout'

const S_COLOR={nouveau:'status-blue',en_cours:'status-yellow',en_attente:'status-grey',resolu:'status-green',annule:'status-grey'}
const G_ICON={faible:'🟢',moyen:'🟡',urgent:'🔴'}

export default function Incidents() {
  const { profile, session } = useAuth()
  const [sel, setSel]     = useState(null)
  const [filter, setFilter] = useState('tous')

  const { data:items=[], loading, error, reload } = useLoad(async () => {
    if (!session?.user) return []
    let q = supabase.from('incidents').select('*,biens(adresse,ville),profiles!signale_par(nom,prenom)').order('created_at',{ascending:false})
    if (profile?.role==='locataire') q = q.eq('signale_par', session.user.id)
    const {data} = await q.limit(100)
    return data || []
  }, [session?.user?.id, profile?.role])

  async function updateStatut(id, statut) {
    await supabase.from('incidents').update({statut}).eq('id',id)
    reload()
    if (sel?.id===id) setSel(s=>({...s,statut}))
  }

  const filtered = filter==='tous' ? items : items.filter(i=>filter==='urgents'?i.gravite==='urgent':i.statut===filter)

  if (loading) return <Layout><div className="it-center"><div className="it-spinner"/></div></Layout>
  if (error)   return <Layout><div className="it-center"><div className="alert alert-error">{error}<br/><button className="btn btn-secondary btn-sm" style={{marginTop:8}} onClick={reload}>↺</button></div></div></Layout>

  return (
    <Layout>
      <div className="page-header">
        <div><h1 className="page-title">Incidents</h1><p className="page-sub">{items.filter(i=>i.statut!=='resolu').length} ouvert(s)</p></div>
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          {['tous','urgents','nouveau','en_cours','resolu'].map(f=>(
            <button key={f} className={`btn btn-sm ${filter===f?'btn-primary':'btn-secondary'}`} onClick={()=>setFilter(f)}>{f}</button>
          ))}
        </div>
      </div>
      {filtered.length===0 && <div className="card"><div className="card-body" style={{textAlign:'center',color:'#9E9890',padding:32}}>✅ Aucun incident</div></div>}
      {filtered.map(inc=>(
        <div key={inc.id} className="card" style={{marginBottom:8,cursor:'pointer'}} onClick={()=>setSel(inc)}>
          <div className="row-item">
            <span style={{fontSize:18}}>{G_ICON[inc.gravite]||'⚪'}</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:500,fontSize:13,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{inc.titre}</div>
              <div style={{fontSize:11,color:'#9E9890'}}>{inc.biens?.adresse} · {inc.profiles?.prenom} {inc.profiles?.nom} · {new Date(inc.created_at).toLocaleDateString('fr-FR')}</div>
            </div>
            <span className={`status ${S_COLOR[inc.statut]||'status-grey'}`}>{inc.statut.replace('_',' ')}</span>
          </div>
        </div>
      ))}
      {sel && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setSel(null)}>
          <div className="modal modal-lg">
            <div className="modal-header"><span className="modal-title">{sel.titre}</span><button className="modal-close" onClick={()=>setSel(null)}>✕</button></div>
            <div className="modal-body">
              <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:8}}>
                <span className={`status ${S_COLOR[sel.statut]}`}>{sel.statut.replace('_',' ')}</span>
                <span className="status status-grey">{G_ICON[sel.gravite]} {sel.gravite}</span>
                {sel.biens?.adresse && <span className="status status-grey">📍 {sel.biens.adresse}</span>}
              </div>
              {sel.description && <p style={{fontSize:14,lineHeight:1.6,color:'#1A1714'}}>{sel.description}</p>}
              <div>
                <label style={{fontSize:10,fontWeight:700,color:'#6B6560',textTransform:'uppercase',letterSpacing:'.05em',display:'block',marginBottom:6}}>Changer le statut</label>
                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                  {['nouveau','en_cours','en_attente','resolu','annule'].map(s=>(
                    <button key={s} className={`btn btn-sm ${sel.statut===s?'btn-primary':'btn-secondary'}`} onClick={()=>updateStatut(sel.id,s)}>{s.replace('_',' ')}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
