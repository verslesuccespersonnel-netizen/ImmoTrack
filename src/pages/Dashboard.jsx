import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

export default function Dashboard() {
  const { profile, session } = useAuth()
  const navigate = useNavigate()
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)

  useEffect(() => {
    if (!session?.user || !profile) return
    let cancelled = false
    const ctrl = new AbortController()
    const timeout = setTimeout(() => ctrl.abort(), 8000)

    async function load() {
      try {
        let result
        if (profile.role === 'locataire') {
          const [{ data: locs }, { data: incs }, { count: msgs }] = await Promise.all([
            supabase.from('locations').select('bien_id, loyer_mensuel, biens(id,adresse,ville)').eq('locataire_id', session.user.id).eq('statut','actif'),
            supabase.from('incidents').select('id, titre, statut, gravite, created_at').eq('signale_par', session.user.id).order('created_at',{ascending:false}).limit(5),
            supabase.from('messages').select('id',{count:'exact',head:true}).eq('destinataire',session.user.id).eq('lu',false),
          ])
          result = { role:'locataire', biens:(locs||[]).map(l=>l.biens).filter(Boolean), incidents:incs||[], messages:msgs||0 }
        } else {
          const { data: biens } = await supabase.from('biens').select('id,adresse,ville,type_bien, locations(id,statut,loyer_mensuel)').eq('proprietaire_id', session.user.id)
          const bienIds = (biens||[]).map(b=>b.id)
          const [{ data: incs }, { count: msgs }] = await Promise.all([
            bienIds.length > 0
              ? supabase.from('incidents').select('id,titre,statut,gravite,created_at,biens(adresse)').in('bien_id',bienIds).neq('statut','resolu').order('created_at',{ascending:false}).limit(6)
              : Promise.resolve({data:[]}),
            supabase.from('messages').select('id',{count:'exact',head:true}).eq('destinataire',session.user.id).eq('lu',false),
          ])
          result = { role:'owner', biens:biens||[], incidents:incs||[], messages:msgs||0 }
        }
        if (!cancelled) { setData(result); setError(null) }
      } catch(e) {
        if (!cancelled && !ctrl.signal.aborted) setError(e.message)
      } finally {
        clearTimeout(timeout)
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true; ctrl.abort() }
  }, [session?.user?.id, profile?.role])

  if (loading) return <Layout><div className="it-center"><div className="it-spinner"/></div></Layout>
  if (error) return <Layout><div className="it-center"><div className="alert alert-error" style={{maxWidth:320,textAlign:'center'}}>{error}<br/><button className="btn btn-secondary btn-sm" style={{marginTop:10}} onClick={()=>window.location.reload()}>↺ Réessayer</button></div></div></Layout>

  const urgentCount = (data?.incidents||[]).filter(i=>i.gravite==='urgent').length

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {data?.role==='locataire' ? `Bonjour, ${profile?.prenom} 👋` : 'Tableau de bord'}
          </h1>
          <p className="page-sub">
            {data?.role==='locataire'
              ? (data.biens[0] ? `${data.biens[0].adresse}, ${data.biens[0].ville}` : 'Bienvenue sur ImmoTrack')
              : `${profile?.prenom} ${profile?.nom} · ${data?.biens?.length||0} bien(s)`}
          </p>
        </div>
        {data?.role==='locataire'
          ? <button className="btn btn-primary" onClick={() => navigate('/signaler')}>➕ Signaler</button>
          : <button className="btn btn-primary" onClick={() => navigate('/biens')}>🏢 Mes biens</button>
        }
      </div>

      <div className="grid3" style={{ marginBottom:20 }}>
        {data?.role==='locataire' ? (
          <>
            <div className="stat-card"><div className="stat-val">{(data.incidents||[]).filter(i=>i.statut!=='resolu').length}</div><div className="stat-label">Incidents ouverts</div><div className="stat-sub">{urgentCount>0?`${urgentCount} urgent(s)`:'Aucun urgent'}</div></div>
            <div className="stat-card"><div className="stat-val">{data.messages}</div><div className="stat-label">Messages non lus</div></div>
            <div className="stat-card"><div className="stat-val">{data.biens.length}</div><div className="stat-label">Logement(s)</div></div>
          </>
        ) : (
          <>
            <div className="stat-card"><div className="stat-val">{data?.biens?.length||0}</div><div className="stat-label">Biens gérés</div><div className="stat-sub">{(data?.biens||[]).filter(b=>b.locations?.some(l=>l.statut==='actif')).length} occupé(s)</div></div>
            <div className="stat-card"><div className="stat-val" style={{ color: urgentCount>0?'#B83232':'inherit' }}>{data?.incidents?.length||0}</div><div className="stat-label">Incidents ouverts</div><div className="stat-sub">{urgentCount>0?`🔴 ${urgentCount} urgent(s)`:'Aucun urgent'}</div></div>
            <div className="stat-card"><div className="stat-val">{(data?.biens||[]).reduce((s,b)=>s+(Number(b.locations?.find(l=>l.statut==='actif')?.loyer_mensuel)||0),0).toLocaleString('fr-FR')} €</div><div className="stat-label">Loyers / mois</div></div>
          </>
        )}
      </div>

      {(data?.incidents||[]).length > 0 && (
        <div className="card" style={{ marginBottom:16 }}>
          <div className="card-header">
            <span className="card-title">{urgentCount>0?'🔴 Incidents urgents':'Incidents récents'}</span>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/incidents')}>Voir tout →</button>
          </div>
          {(data?.incidents||[]).slice(0,5).map(inc => (
            <div key={inc.id} className="row-item" style={{ cursor:'pointer' }} onClick={() => navigate('/incidents')}>
              <span style={{ fontSize:16 }}>{inc.gravite==='urgent'?'🔴':inc.gravite==='moyen'?'🟡':'🟢'}</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{inc.titre}</div>
                <div style={{ fontSize:11, color:'#9E9890' }}>{new Date(inc.created_at).toLocaleDateString('fr-FR')}{inc.biens?.adresse?' · '+inc.biens.adresse:''}</div>
              </div>
              <span className={`status ${inc.statut==='resolu'?'status-green':inc.statut==='en_cours'?'status-yellow':'status-blue'}`}>{inc.statut.replace('_',' ')}</span>
            </div>
          ))}
        </div>
      )}

      {data?.role!=='locataire' && (data?.biens||[]).length===0 && (
        <div className="card">
          <div className="card-body" style={{ textAlign:'center', padding:'40px 24px' }}>
            <div style={{ fontSize:48, marginBottom:12 }}>🏢</div>
            <h2 style={{ fontFamily:'Georgia,serif', fontSize:20, fontWeight:500, marginBottom:8 }}>Bienvenue !</h2>
            <p style={{ color:'#6B6560', fontSize:13, marginBottom:16 }}>Commencez par ajouter votre premier bien.</p>
            <button className="btn btn-primary" onClick={() => navigate('/biens')}>+ Ajouter un bien</button>
          </div>
        </div>
      )}
    </Layout>
  )
}
