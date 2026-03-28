// src/pages/Messages.jsx
import React, { useEffect, useState, useRef } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase, subscribeToMessages } from '../lib/supabase'
import Layout from '../components/Layout'
import { formatDate } from '../lib/utils'

export default function Messages() {
  const { profile, session } = useAuth()
  const [conversations, setConvs] = useState([])
  const [activeConv, setActive]   = useState(null) // { userId, name, incidentId }
  const [messages, setMessages]   = useState([])
  const [input, setInput]         = useState('')
  const [loading, setLoading]     = useState(true)
  const [sending, setSending]     = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    loadConversations()
    // Notifications temps réel
    const sub = subscribeToMessages(session?.user.id, () => {
      loadConversations()
      if (activeConv) loadMessages(activeConv)
    })
    return () => sub?.unsubscribe()
  }, [session])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadConversations() {
    if (!session) return
    setLoading(true)
    try {
      // Tous les messages impliquant cet utilisateur
      const { data } = await supabase
        .from('messages')
        .select(`
          *,
          expediteur:profiles!messages_expediteur_fkey(id, nom, prenom),
          destinataire_profile:profiles!messages_destinataire_fkey(id, nom, prenom),
          incident:incidents(id, titre)
        `)
        .or(`expediteur.eq.${session.user.id},destinataire.eq.${session.user.id}`)
        .order('created_at', { ascending: false })

      // Grouper par paire d'utilisateurs + incident
      const convMap = new Map()
      for (const msg of (data || [])) {
        const otherId = msg.expediteur === session.user.id
          ? msg.destinataire
          : msg.expediteur
        const otherProfile = msg.expediteur === session.user.id
          ? msg.destinataire_profile
          : msg.expediteur

        const key = `${otherId}_${msg.incident_id || 'general'}`
        if (!convMap.has(key)) {
          convMap.set(key, {
            key,
            userId: otherId,
            name: `${otherProfile?.prenom} ${otherProfile?.nom}`,
            incidentId: msg.incident_id,
            incidentTitre: msg.incident?.titre,
            lastMessage: msg.contenu,
            lastDate: msg.created_at,
            unread: 0,
          })
        }
        if (msg.destinataire === session.user.id && !msg.lu) {
          convMap.get(key).unread++
        }
      }

      setConvs([...convMap.values()])
    } finally {
      setLoading(false)
    }
  }

  async function loadMessages(conv) {
    setActive(conv)
    setMessages([])

    let query = supabase
      .from('messages')
      .select('*, expediteur:profiles!messages_expediteur_fkey(id, nom, prenom)')
      .or(`expediteur.eq.${session.user.id},destinataire.eq.${session.user.id}`)
      .order('created_at', { ascending: true })

    // Filtrer par conversation (avec ou sans incident)
    if (conv.incidentId) {
      query = query.eq('incident_id', conv.incidentId)
    } else {
      query = query.is('incident_id', null)
        .or(`and(expediteur.eq.${session.user.id},destinataire.eq.${conv.userId}),and(expediteur.eq.${conv.userId},destinataire.eq.${session.user.id})`)
    }

    const { data } = await query
    setMessages(data || [])

    // Marquer comme lus
    await supabase.from('messages')
      .update({ lu: true })
      .eq('destinataire', session.user.id)
      .eq('expediteur', conv.userId)
      .eq('lu', false)

    // Mettre à jour localement
    setConvs(prev => prev.map(c => c.key === conv.key ? { ...c, unread: 0 } : c))
  }

  async function handleSend() {
    if (!input.trim() || !activeConv || sending) return
    setSending(true)
    try {
      const { data, error } = await supabase.from('messages').insert({
        incident_id: activeConv.incidentId || null,
        expediteur: session.user.id,
        destinataire: activeConv.userId,
        contenu: input.trim(),
      }).select('*, expediteur:profiles!messages_expediteur_fkey(id, nom, prenom)').single()

      if (!error) {
        setMessages(prev => [...prev, data])
        setInput('')
        // Rafraîchir la liste des conversations
        setConvs(prev => prev.map(c =>
          c.key === activeConv.key
            ? { ...c, lastMessage: input.trim(), lastDate: new Date().toISOString() }
            : c
        ))
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <Layout>
      <div style={css.header}>
        <h1 style={css.h1}>Messages</h1>
      </div>

      <div style={css.layout}>
        {/* CONVERSATION LIST */}
        <div style={css.sidebar}>
          <div style={css.sidebarHead}>Conversations</div>
          {loading
            ? <div style={css.loading}>Chargement...</div>
            : conversations.length === 0
              ? <div style={css.empty}>Aucune conversation.</div>
              : conversations.map(conv => (
                  <ConvItem key={conv.key} conv={conv}
                    active={activeConv?.key === conv.key}
                    onClick={() => loadMessages(conv)} />
                ))
          }
        </div>

        {/* CHAT AREA */}
        <div style={css.chat}>
          {!activeConv
            ? <div style={css.emptyChat}>
                <div style={{ fontSize: 40 }}>💬</div>
                <p style={{ color: '#9E9890' }}>Sélectionnez une conversation</p>
              </div>
            : <>
                {/* Chat header */}
                <div style={css.chatHeader}>
                  <div style={css.convAvatar}>
                    {activeConv.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{activeConv.name}</div>
                    {activeConv.incidentTitre && (
                      <div style={{ fontSize: 12, color: '#6B6560' }}>
                        ⚠️ {activeConv.incidentTitre}
                      </div>
                    )}
                  </div>
                </div>

                {/* Messages */}
                <div style={css.msgList}>
                  {messages.length === 0 && (
                    <div style={css.emptyMsg}>Aucun message. Commencez la conversation !</div>
                  )}
                  {messages.map((msg, i) => {
                    const mine = msg.expediteur === session?.user.id
                    const showDate = i === 0 ||
                      new Date(msg.created_at).toDateString() !==
                      new Date(messages[i-1].created_at).toDateString()
                    return (
                      <React.Fragment key={msg.id}>
                        {showDate && (
                          <div style={css.dateSep}>{formatDate(msg.created_at)}</div>
                        )}
                        <div style={{ display: 'flex', flexDirection: mine ? 'row-reverse' : 'row',
                                       gap: 8, alignItems: 'flex-end', marginBottom: 10 }}>
                          <div style={{ ...css.msgAvatar,
                                         background: mine ? '#2D5A3D' : '#EBF2FC',
                                         color: mine ? 'white' : '#2B5EA7' }}>
                            {(mine ? profile?.prenom?.[0] : activeConv.name[0]) || '?'}
                          </div>
                          <div style={{ ...css.bubble,
                                         background: mine ? '#2D5A3D' : '#F7F5F0',
                                         color: mine ? 'white' : '#1A1714',
                                         borderBottomRightRadius: mine ? 4 : 12,
                                         borderBottomLeftRadius: mine ? 12 : 4 }}>
                            <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>{msg.contenu}</div>
                            <div style={{ fontSize: 10, opacity: 0.65, marginTop: 4,
                                           textAlign: 'right' }}>
                              {formatDate(msg.created_at, true)}
                              {mine && <span style={{ marginLeft: 4 }}>✓{msg.lu ? '✓' : ''}</span>}
                            </div>
                          </div>
                        </div>
                      </React.Fragment>
                    )
                  })}
                  <div ref={bottomRef} />
                </div>

                {/* Input */}
                <div style={css.inputRow}>
                  <input
                    style={css.input}
                    value={input}
                    placeholder="Votre message…"
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                  />
                  <button style={{ ...css.btnPrimary, opacity: sending ? 0.7 : 1 }}
                    onClick={handleSend} disabled={sending}>
                    {sending ? '…' : 'Envoyer'}
                  </button>
                </div>
              </>
          }
        </div>
      </div>
    </Layout>
  )
}

// ── CONVERSATION ITEM ────────────────────────────────────
function ConvItem({ conv, active, onClick }) {
  return (
    <div style={{
      padding: '12px 14px', borderBottom: '1px solid rgba(0,0,0,0.06)',
      cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'flex-start',
      background: active ? '#E8F2EB' : 'transparent',
      transition: '0.12s',
    }} onClick={onClick}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        background: active ? '#2D5A3D' : '#EBF2FC',
        color: active ? 'white' : '#2B5EA7',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 600, flexShrink: 0,
      }}>
        {conv.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: conv.unread ? 700 : 500,
                       display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {conv.name}
          </span>
          {conv.unread > 0 && (
            <span style={{ background: '#B83232', color: 'white', borderRadius: 10,
                            fontSize: 10, fontWeight: 700, padding: '1px 6px',
                            marginLeft: 6, flexShrink: 0 }}>
              {conv.unread}
            </span>
          )}
        </div>
        {conv.incidentTitre && (
          <div style={{ fontSize: 11, color: '#C8813A', marginTop: 1 }}>
            ⚠️ {conv.incidentTitre}
          </div>
        )}
        <div style={{ fontSize: 12, color: '#9E9890', overflow: 'hidden',
                       textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
          {conv.lastMessage}
        </div>
      </div>
    </div>
  )
}

const css = {
  header:     { marginBottom: 20 },
  h1:         { fontFamily: 'Georgia,serif', fontSize: 24, fontWeight: 500, color: '#1A1714', margin: 0 },
  layout:     { display: 'grid', gridTemplateColumns: '240px 1fr', gap: 16, height: 'calc(100vh - 170px)', minHeight: 400 },
  sidebar:    { background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  sidebarHead:{ padding: '12px 14px', borderBottom: '1px solid rgba(0,0,0,0.07)', fontWeight: 600, fontSize: 12, color: '#6B6560', textTransform: 'uppercase', letterSpacing: '0.05em' },
  chat:       { background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  chatHeader: { padding: '14px 18px', borderBottom: '1px solid rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', gap: 12 },
  convAvatar: { width: 36, height: 36, borderRadius: '50%', background: '#2D5A3D', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0 },
  msgList:    { flex: 1, overflowY: 'auto', padding: '16px 18px' },
  dateSep:    { textAlign: 'center', fontSize: 11, color: '#9E9890', margin: '10px 0', userSelect: 'none' },
  msgAvatar:  { width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, flexShrink: 0 },
  bubble:     { maxWidth: '72%', padding: '10px 14px', borderRadius: 12 },
  inputRow:   { padding: '12px 16px', borderTop: '1px solid rgba(0,0,0,0.07)', display: 'flex', gap: 8 },
  input:      { flex: 1, padding: '9px 12px', border: '1px solid rgba(0,0,0,0.15)', borderRadius: 8, fontFamily: 'inherit', fontSize: 13.5, outline: 'none' },
  btnPrimary: { padding: '9px 18px', background: '#2D5A3D', color: '#fff', border: 'none', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, fontWeight: 500, cursor: 'pointer' },
  loading:    { padding: '24px', textAlign: 'center', color: '#9E9890', fontSize: 13 },
  empty:      { padding: '24px', textAlign: 'center', color: '#9E9890', fontSize: 13 },
  emptyChat:  { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyMsg:   { textAlign: 'center', color: '#9E9890', fontSize: 13, padding: '24px 0' },
}
