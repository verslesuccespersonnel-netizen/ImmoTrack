import React, { useEffect, useState, useRef } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

export default function Messages() {
  const { session, profile } = useAuth()
  const [msgs, setMsgs] = useState([])
  const [text, setText] = useState('')
  const [destId, setDestId] = useState('')
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef(null)

  useEffect(() => {
    if (!session) return
    supabase.from('profiles').select('id,nom,prenom,role').neq('id', session.user.id)
      .then(({data}) => setContacts(data||[]))
    loadMsgs()
    const sub = supabase.channel('msgs').on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},()=>loadMsgs()).subscribe()
    return () => sub.unsubscribe()
  }, [session])

  useEffect(() => { bottomRef.current?.scrollIntoView({behavior:'smooth'}) }, [msgs])

  async function loadMsgs() {
    const { data } = await supabase.from('messages').select('*, profiles!expediteur(nom,prenom)').or(`expediteur.eq.${session.user.id},destinataire.eq.${session.user.id}`).order('created_at')
    setMsgs(data||[])
    setLoading(false)
  }

  async function send() {
    if (!text.trim() || !destId) return
    await supabase.from('messages').insert({ expediteur:session.user.id, destinataire:destId, contenu:text.trim() })
    setText('')
  }

  const filtered = destId ? msgs.filter(m => (m.expediteur===destId||m.destinataire===destId)&&(m.expediteur===session.user.id||m.destinataire===session.user.id)) : []

  if (loading) return <Layout><div className="it-center"><div className="it-spinner"/></div></Layout>
  return (
    <Layout>
      <div className="page-header"><h1 className="page-title">Messages</h1></div>
      <div style={{ display:'flex', gap:12, height:'calc(100vh - 200px)', minHeight:400 }}>
        <div style={{ width:200, background:'#fff', border:'1px solid rgba(0,0,0,.08)', borderRadius:12, overflow:'auto', flexShrink:0 }}>
          {contacts.map(c => <div key={c.id} onClick={()=>setDestId(c.id)} style={{ padding:'10px 14px', cursor:'pointer', background:destId===c.id?'#E8F2EB':'transparent', borderBottom:'1px solid rgba(0,0,0,.05)' }}><div style={{ fontWeight:500, fontSize:13 }}>{c.prenom} {c.nom}</div><div style={{ fontSize:11, color:'#9E9890' }}>{c.role}</div></div>)}
        </div>
        <div style={{ flex:1, display:'flex', flexDirection:'column', background:'#fff', border:'1px solid rgba(0,0,0,.08)', borderRadius:12, overflow:'hidden' }}>
          <div style={{ flex:1, overflowY:'auto', padding:16, display:'flex', flexDirection:'column', gap:8 }}>
            {!destId && <div style={{ textAlign:'center', color:'#9E9890', margin:'auto', fontSize:13 }}>← Sélectionnez un contact</div>}
            {filtered.map(m => <div key={m.id} style={{ alignSelf:m.expediteur===session.user.id?'flex-end':'flex-start', maxWidth:'70%', background:m.expediteur===session.user.id?'#E8F2EB':'#F7F5F0', padding:'8px 12px', borderRadius:10, fontSize:13 }}>{m.contenu}<div style={{ fontSize:10, color:'#9E9890', marginTop:3 }}>{new Date(m.created_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</div></div>)}
            <div ref={bottomRef}/>
          </div>
          {destId && <div style={{ padding:'10px 14px', borderTop:'1px solid rgba(0,0,0,.07)', display:'flex', gap:8 }}>
            <input style={{ flex:1, padding:'8px 12px', border:'1px solid rgba(0,0,0,.15)', borderRadius:8, fontFamily:'inherit', fontSize:13, outline:'none' }} value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder="Écrire un message…" />
            <button className="btn btn-primary" onClick={send}>Envoyer</button>
          </div>}
        </div>
      </div>
    </Layout>
  )
}
