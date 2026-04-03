import React, { useEffect, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

export default function Documents() {
  const { session, profile } = useAuth()
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) return
    async function load() {
      let q = supabase.from('documents').select('*, biens(adresse)').order('created_at',{ascending:false})
      const { data } = await q
      setDocs(data||[])
      setLoading(false)
    }
    load()
  }, [session])

  if (loading) return <Layout><div className="it-center"><div className="it-spinner"/></div></Layout>
  return (
    <Layout>
      <div className="page-header"><div><h1 className="page-title">Documents</h1><p className="page-sub">{docs.length} document(s)</p></div></div>
      {docs.length === 0 && <div className="card"><div className="card-body" style={{textAlign:'center',padding:40,color:'#9E9890'}}>Aucun document.</div></div>}
      {docs.map(d => (
        <div key={d.id} className="card" style={{ marginBottom:8 }}>
          <div className="row-item">
            <span style={{ fontSize:20 }}>📄</span>
            <div style={{ flex:1 }}><div style={{ fontWeight:500, fontSize:13 }}>{d.nom}</div><div style={{ fontSize:11, color:'#9E9890' }}>{d.type} · {d.biens?.adresse} · {new Date(d.created_at).toLocaleDateString('fr-FR')}</div></div>
            <a href={d.url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">⬇️</a>
          </div>
        </div>
      ))}
    </Layout>
  )
}
