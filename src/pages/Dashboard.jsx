import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { useLoad } from '../lib/useLoad'
import Layout from '../components/Layout'

function BarChart({ data, height=80 }) {
  if (!data?.length) return null
  const max = Math.max(...data.map(d=>d.value), 1)
  return (
    <div style={{display:'flex',alignItems:'flex-end',gap:4,height,marginTop:8}}>
      {data.map((d,i)=>(
        <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
          {d.value>0 && <div style={{fontSize:9,color:'#9E9890'}}>{d.value}</div>}
          <div style={{width:'100%',borderRadius:'3px 3px 0 0',background:d.color||'#2D5A3D',height:`${Math.max(4,(d.value/max)*100)}%`}}/>
          <div style={{fontSize:9,color:'#9E9890'}}>{d.label}</div>
        </div>
      ))}
    </div>
  )
}

function Donut({pct,color='#2D5A3D',size=60,label}) {
  const r=22, c=2*Math.PI*r, dash=(pct/100)*c
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
      <svg width={size} height={size} viewBox="0 0 52 52">
        <circle cx="26" cy="26" r={r} fill="none" stroke="#F0EDE6" strokeWidth="5"/>
        <circle cx="26" cy="26" r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={`${dash} ${c}`} strokeLinecap="round"
          transform="rotate(-90 26 26)"/>
        <text x="26" y="30" textAnchor="middle" fontSize="10" fontWeight="700" fill={color}>{pct}%</text>
      </svg>
      {label && <div style={{fontSize:10,color:'#6B6560'}}>{label}</div>}
    </div>
  )
}

export default function Dashboard() {
  const { profile, session } = useAuth()
  const navigate = useNavigate()

  const { data, loading, error, reload } = useLoad(async () => {
    if (!session?.user || !profile) return null
    const MGR = ['proprietaire','gestionnaire','agence','admin']
    if (profile.role === 'locataire') return loadLocataire(session.user.id)
    if (MGR.includes(profile.role)) return loadOwner(session.user.id)
    return { role:'other', incidents:[], messages:0 }
  }, [session?.user?.id, profile?.role])

  if (loading) return <Layout><div className="it-center"><div className="it-spinner"/></div></Layout>
  if (error)   return <Layout><div className="it-center"><div className="alert alert-error">{error}<br/><button className="btn btn-secondary btn-sm" style={{marginTop:8}} onClick={reload}>↺ Réessayer</button></div></div></Layout>

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1 className="page-title">{profile?.role==='locataire'?`Bonjour, ${profile?.prenom} 👋`:'Tableau de bord'}</h1>
          <p className="page-sub">{profile?.role==='locataire'?(data?.bien?`${data.bien.adresse}, ${data.bien.ville}`:'Bienvenue'):`${profile?.prenom} ${profile?.nom} · ${data?.biens?.length||0} bien(s)`}</p>
        </div>
        <div style={{display:'flex',gap:8}}>
          {profile?.role==='locataire'
            ? <button className="btn btn-primary" onClick={()=>navigate('/signaler')}>➕ Signaler</button>
            : <button className="btn btn-primary" onClick={()=>navigate('/biens')}>🏢 Mes biens</button>
          }
        </div>
      </div>

      <div className="grid3" style={{marginBottom:20}}>
        {profile?.role==='locataire' ? <>
          <div className="stat-card"><div className="stat-val" style={{color:(data?.incidents||[]).filter(i=>i.gravite==='urgent').length>0?'#B83232':'inherit'}}>{(data?.incidents||[]).filter(i=>i.statut!=='resolu').length}</div><div className="stat-label">Incidents ouverts</div></div>
          <div className="stat-card"><div className="stat-val">{data?.messages||0}</div><div className="stat-label">Messages non lus</div></div>
          <div className="stat-card"><div className="stat-val">{data?.docs||0}</div><div className="stat-label">Documents</div></div>
        </> : <>
          <div className="stat-card">
            <div style={{display:'flex',justifyContent:'space-between'}}>
              <div><div className="stat-val">{data?.biens?.length||0}</div><div className="stat-label">Biens</div><div className="stat-sub">{(data?.biens||[]).filter(b=>b.locations?.some(l=>l.statut==='actif')).length} occupé(s)</div></div>
              <Donut pct={data?.biens?.length>0?Math.round(((data?.biens||[]).filter(b=>b.locations?.some(l=>l.statut==='actif')).length/(data?.biens?.length||1))*100):0} label="Occupation"/>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-val" style={{color:(data?.incidents||[]).filter(i=>i.gravite==='urgent').length>0?'#B83232':'inherit'}}>{(data?.incidents||[]).length}</div>
            <div className="stat-label">Incidents ouverts</div>
            <div className="stat-sub">{(data?.incidents||[]).filter(i=>i.gravite==='urgent').length>0?`🔴 ${(data?.incidents||[]).filter(i=>i.gravite==='urgent').length} urgent(s)`:'✅ Aucun urgent'}</div>
          </div>
          <div className="stat-card">
            <div className="stat-val">{(data?.totalLoyers||0)>0?`${(data.totalLoyers).toLocaleString('fr-FR')} €`:'—'}</div>
            <div className="stat-label">Loyers / mois</div>
          </div>
        </>}
      </div>

      {data?.incidentsByMonth?.some(m=>m.value>0) && (
        <div className="card" style={{marginBottom:16}}>
          <div className="card-header"><span className="card-title">📈 Incidents — 6 derniers mois</span></div>
          <div className="card-body"><BarChart data={data.incidentsByMonth} height={90}/></div>
        </div>
      )}

      {(data?.incidents||[]).filter(i=>i.gravite==='urgent').length>0 && (
        <div className="card" style={{marginBottom:16,borderLeft:'3px solid #B83232'}}>
          <div className="card-header"><span className="card-title" style={{color:'#B83232'}}>🔴 Urgents</span><button className="btn btn-secondary btn-sm" onClick={()=>navigate('/incidents')}>Voir tout →</button></div>
          {(data.incidents||[]).filter(i=>i.gravite==='urgent').slice(0,3).map(inc=>(
            <div key={inc.id} className="row-item" style={{cursor:'pointer'}} onClick={()=>navigate('/incidents')}>
              <span>🔴</span><div style={{flex:1}}><div style={{fontSize:13,fontWeight:500}}>{inc.titre}</div><div style={{fontSize:11,color:'#9E9890'}}>{inc.biens?.adresse}</div></div>
            </div>
          ))}
        </div>
      )}

      {(data?.incidents||[]).length>0 && (
        <div className="card" style={{marginBottom:16}}>
          <div className="card-header"><span className="card-title">Incidents récents</span><button className="btn btn-secondary btn-sm" onClick={()=>navigate('/incidents')}>Voir tout →</button></div>
          {(data.incidents||[]).slice(0,5).map(inc=>(
            <div key={inc.id} className="row-item" style={{cursor:'pointer'}} onClick={()=>navigate('/incidents')}>
              <span>{inc.gravite==='urgent'?'🔴':inc.gravite==='moyen'?'🟡':'🟢'}</span>
              <div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{inc.titre}</div><div style={{fontSize:11,color:'#9E9890'}}>{inc.biens?.adresse} · {new Date(inc.created_at).toLocaleDateString('fr-FR')}</div></div>
              <span className={`status ${inc.statut==='resolu'?'status-green':inc.statut==='en_cours'?'status-yellow':'status-blue'}`}>{inc.statut.replace('_',' ')}</span>
            </div>
          ))}
        </div>
      )}

      {profile?.role!=='locataire' && (data?.biens||[]).length>0 && (
        <div className="grid3">
          {(data.biens||[]).slice(0,5).map(b=>{
            const loc=b.locations?.find(l=>l.statut==='actif')
            return (
              <div key={b.id} className="card" style={{cursor:'pointer'}} onClick={()=>navigate('/biens')}>
                <div className="card-body" style={{padding:14}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}><span style={{fontSize:22}}>🏠</span><span className={`status ${loc?'status-green':'status-grey'}`}>{loc?'Occupé':'Vacant'}</span></div>
                  <div style={{fontWeight:600,fontSize:13}}>{b.adresse}</div>
                  <div style={{fontSize:12,color:'#6B6560'}}>{b.ville}</div>
                  {loc && <div style={{fontSize:12,color:'#9E9890',marginTop:4}}>{Number(loc.loyer_mensuel).toLocaleString('fr-FR')} €/mois</div>}
                </div>
              </div>
            )
          })}
          <div className="card" style={{cursor:'pointer',border:'2px dashed rgba(0,0,0,.1)'}} onClick={()=>navigate('/biens')}>
            <div className="card-body" style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24,color:'#9E9890',gap:4}}><span style={{fontSize:24}}>+</span><span style={{fontSize:12}}>Ajouter</span></div>
          </div>
        </div>
      )}

      {profile?.role!=='locataire' && (data?.biens||[]).length===0 && (
        <div className="card"><div className="card-body" style={{textAlign:'center',padding:40}}>
          <div style={{fontSize:48}}>🏢</div>
          <h2 style={{fontFamily:'Georgia,serif',fontSize:20,fontWeight:500,margin:'12px 0 8px'}}>Bienvenue !</h2>
          <p style={{color:'#6B6560',fontSize:13,marginBottom:16}}>Commencez par ajouter votre premier bien.</p>
          <button className="btn btn-primary" onClick={()=>navigate('/biens')}>+ Ajouter</button>
        </div></div>
      )}
    </Layout>
  )
}

async function loadLocataire(userId) {
  const [{data:locs},{data:incs},{count:msgs},{count:docs}] = await Promise.all([
    supabase.from('locations').select('biens(id,adresse,ville)').eq('locataire_id',userId).eq('statut','actif').limit(1),
    supabase.from('incidents').select('id,titre,statut,gravite,created_at').eq('signale_par',userId).order('created_at',{ascending:false}).limit(5),
    supabase.from('messages').select('id',{count:'exact',head:true}).eq('destinataire',userId).eq('lu',false),
    supabase.from('documents').select('id',{count:'exact',head:true}),
  ])
  return { role:'locataire', bien:locs?.[0]?.biens||null, incidents:incs||[], messages:msgs||0, docs:docs||0 }
}

async function loadOwner(userId) {
  const {data:biens,error} = await supabase.from('biens').select('id,adresse,ville,type_bien,locations(id,statut,loyer_mensuel)').eq('proprietaire_id',userId)
  if(error) throw error
  const bienIds=(biens||[]).map(b=>b.id)
  const [{data:incs},{count:msgs}] = await Promise.all([
    bienIds.length>0 ? supabase.from('incidents').select('id,titre,statut,gravite,created_at,biens(adresse)').in('bien_id',bienIds).neq('statut','resolu').order('created_at',{ascending:false}).limit(10) : Promise.resolve({data:[]}),
    supabase.from('messages').select('id',{count:'exact',head:true}).eq('destinataire',userId).eq('lu',false),
  ])
  const totalLoyers=(biens||[]).reduce((s,b)=>s+(Number(b.locations?.find(l=>l.statut==='actif')?.loyer_mensuel)||0),0)
  const now=new Date()
  const months=Array.from({length:6},(_,i)=>{const d=new Date(now.getFullYear(),now.getMonth()-5+i,1);return{label:d.toLocaleDateString('fr-FR',{month:'short'}),year:d.getFullYear(),month:d.getMonth(),value:0,color:'#2D5A3D'}})
  if(bienIds.length>0){
    const {data:allIncs} = await supabase.from('incidents').select('created_at').in('bien_id',bienIds).gte('created_at',new Date(now.getFullYear(),now.getMonth()-5,1).toISOString())
    ;(allIncs||[]).forEach(i=>{const d=new Date(i.created_at);const m=months.find(x=>x.month===d.getMonth()&&x.year===d.getFullYear());if(m)m.value++})
  }
  return { role:'owner', biens:biens||[], incidents:incs||[], messages:msgs||0, totalLoyers, incidentsByMonth:months }
}
