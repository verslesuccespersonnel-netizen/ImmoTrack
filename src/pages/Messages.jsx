import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { useLoad } from '../lib/useLoad'
import Layout from '../components/Layout'

export default function Messages() {
  const { session } = useAuth()
  const [destId, setDestId] = useState(null)
  const [convs, setConvs]   = useState({})
  const [text, setText]     = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  const { data:contacts=[], loading, error, reload } = useLoad(async () => {
    if(!session?.user) return []
    const {data}=await supabase.from('profiles').select('id,nom,prenom,role').neq('id',session.user.id)
    return data||[]
  }, [session?.user?.id])

  useEffect(()=>{
    if(!session?.user) return
    loadMsgs()
    const sub=supabase.channel('msgs_rt').on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},()=>loadMsgs()).subscribe()
    return ()=>sub.unsubscribe()
  }, [session?.user?.id])

  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:'smooth'})},[convs,destId])

  async function loadMsgs(){
    if(!session?.user) return
    const {data:msgs}=await supabase.from('messages')
      .select('*,exp:profiles!expediteur(id,nom,prenom,role),dest:profiles!destinataire(id,nom,prenom,role)')
      .or(`expediteur.eq.${session.user.id},destinataire.eq.${session.user.id}`)
      .order('created_at',{ascending:true})
    if(!msgs) return
    const grouped={}
    msgs.forEach(m=>{
      const otherId=m.expediteur===session.user.id?m.destinataire:m.expediteur
      const other=m.expediteur===session.user.id?m.dest:m.exp
      if(!grouped[otherId])grouped[otherId]={contact:other,messages:[]}
      grouped[otherId].messages.push(m)
    })
    setConvs(grouped)
    const unread=msgs.filter(m=>m.destinataire===session.user.id&&!m.lu).map(m=>m.id)
    if(unread.length>0) await supabase.from('messages').update({lu:true}).in('id',unread)
  }

  async function send(){
    if(!text.trim()||!destId) return
    setSending(true)
    await supabase.from('messages').insert({expediteur:session.user.id,destinataire:destId,contenu:text.trim()})
    setText('');setSending(false)
  }

  const RC={locataire:'#2B5EA7',proprietaire:'#2D5A3D',agence:'#C8813A',admin:'#B83232',prestataire:'#6B6560'}
  const curMsgs = destId?(convs[destId]?.messages||[]):[]
  const convList = Object.entries(convs).map(([id,c])=>({id,...c.contact,unread:c.messages.filter(m=>m.destinataire===session?.user?.id&&!m.lu).length,lastMsg:c.messages[c.messages.length-1]?.contenu||'',lastDate:c.messages[c.messages.length-1]?.created_at})).sort((a,b)=>new Date(b.lastDate||0)-new Date(a.lastDate||0))
  const newContacts = contacts.filter(c=>!convs[c.id])

  if(loading)return<Layout><div className="it-center"><div className="it-spinner"/></div></Layout>
  if(error)return<Layout><div className="it-center"><div className="alert alert-error">{error}</div></div></Layout>

  return(
    <Layout>
      <div className="page-header"><h1 className="page-title">Messages</h1></div>
      <div style={{display:'flex',gap:12,height:'calc(100vh - 190px)',minHeight:400}}>
        <div style={{width:230,background:'#fff',border:'1px solid rgba(0,0,0,.08)',borderRadius:12,overflow:'auto',flexShrink:0}}>
          {convList.map(c=>(
            <div key={c.id} onClick={()=>setDestId(c.id)} style={{padding:'11px 13px',cursor:'pointer',borderBottom:'1px solid rgba(0,0,0,.05)',background:destId===c.id?'#E8F2EB':'transparent'}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{width:32,height:32,borderRadius:'50%',background:RC[c.role]||'#6B6560',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,flexShrink:0}}>{c.prenom?.[0]||'?'}{c.nom?.[0]||''}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',justifyContent:'space-between'}}>
                    <span style={{fontWeight:c.unread>0?700:500,fontSize:13}}>{c.prenom} {c.nom}</span>
                    {c.unread>0&&<span style={{background:'#B83232',color:'#fff',borderRadius:10,fontSize:9,fontWeight:700,padding:'1px 5px'}}>{c.unread}</span>}
                  </div>
                  <div style={{fontSize:11,color:'#9E9890',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.lastMsg}</div>
                </div>
              </div>
            </div>
          ))}
          {newContacts.length>0&&<>
            <div style={{padding:'6px 13px',fontSize:10,fontWeight:700,color:'#9E9890',textTransform:'uppercase',marginTop:4}}>Nouveau message</div>
            {newContacts.map(c=>(
              <div key={c.id} onClick={()=>setDestId(c.id)} style={{padding:'9px 13px',cursor:'pointer',borderBottom:'1px solid rgba(0,0,0,.04)',background:destId===c.id?'#E8F2EB':'transparent'}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <div style={{width:28,height:28,borderRadius:'50%',background:'#F7F5F0',color:'#9E9890',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700}}>{c.prenom?.[0]||'?'}</div>
                  <div><div style={{fontSize:12,fontWeight:500}}>{c.prenom} {c.nom}</div><div style={{fontSize:10,color:'#9E9890'}}>{c.role}</div></div>
                </div>
              </div>
            ))}
          </>}
          {convList.length===0&&newContacts.length===0&&<div style={{padding:20,textAlign:'center',color:'#9E9890',fontSize:13}}>Aucun contact</div>}
        </div>
        <div style={{flex:1,display:'flex',flexDirection:'column',background:'#fff',border:'1px solid rgba(0,0,0,.08)',borderRadius:12,overflow:'hidden'}}>
          {!destId?<div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:'#9E9890',fontSize:13,flexDirection:'column',gap:8}}><span style={{fontSize:32}}>💬</span><span>Sélectionnez un contact</span></div>:(<>
            {(()=>{const c=contacts.find(x=>x.id===destId)||convs[destId]?.contact;return c&&<div style={{padding:'12px 16px',borderBottom:'1px solid rgba(0,0,0,.07)',display:'flex',alignItems:'center',gap:10}}><div style={{width:32,height:32,borderRadius:'50%',background:RC[c.role]||'#6B6560',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700}}>{c.prenom?.[0]||'?'}{c.nom?.[0]||''}</div><div><div style={{fontWeight:600,fontSize:13}}>{c.prenom} {c.nom}</div><div style={{fontSize:11,color:'#9E9890'}}>{c.role}</div></div></div>})()}
            <div style={{flex:1,overflowY:'auto',padding:16,display:'flex',flexDirection:'column',gap:8}}>
              {curMsgs.length===0&&<div style={{textAlign:'center',color:'#9E9890',fontSize:13,margin:'auto'}}>Commencez la conversation</div>}
              {curMsgs.map(m=>{const isMe=m.expediteur===session.user.id;return(
                <div key={m.id} style={{display:'flex',justifyContent:isMe?'flex-end':'flex-start'}}>
                  <div style={{maxWidth:'72%',background:isMe?'#E8F2EB':'#F7F5F0',padding:'9px 13px',borderRadius:isMe?'12px 12px 3px 12px':'12px 12px 12px 3px',fontSize:13,lineHeight:1.5}}>
                    <div>{m.contenu}</div>
                    <div style={{fontSize:10,color:'#9E9890',marginTop:3,textAlign:'right'}}>{new Date(m.created_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}{isMe&&<span style={{marginLeft:4}}>{m.lu?'✓✓':'✓'}</span>}</div>
                  </div>
                </div>
              )})}
              <div ref={bottomRef}/>
            </div>
            <div style={{padding:'10px 14px',borderTop:'1px solid rgba(0,0,0,.07)',display:'flex',gap:8}}>
              <input style={{flex:1,padding:'9px 13px',border:'1px solid rgba(0,0,0,.15)',borderRadius:20,fontFamily:'inherit',fontSize:13,outline:'none'}} value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&send()} placeholder="Écrire… (Entrée pour envoyer)" disabled={sending}/>
              <button className="btn btn-primary" onClick={send} disabled={sending||!text.trim()}>{sending?'…':'→'}</button>
            </div>
          </>)}
        </div>
      </div>
    </Layout>
  )
}
