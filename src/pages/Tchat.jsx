import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const MGR = ['proprietaire','gestionnaire','agence','admin']

export default function Tchat() {
  const { session, profile } = useAuth()
  const isMgr = MGR.includes(profile?.role)

  const [groupes,     setGroupes]     = useState([])
  const [selGroupe,   setSelGroupe]   = useState(null)
  const [messages,    setMessages]    = useState([])
  const [text,        setText]        = useState('')
  const [loading,     setLoading]     = useState(true)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [sending,     setSending]     = useState(false)
  const [modalGroupe, setModalGroupe] = useState(false)
  const [formGroupe,  setFormGroupe]  = useState({nom:'', description:''})
  const [formErr,     setFormErr]     = useState('')
  const bottomRef = useRef(null)

  // Charger les groupes accessibles
  const loadGroupes = useCallback(async () => {
    if (!session?.user || !profile?.role) return
    setLoading(true)
    try {
      let data
      if (isMgr) {
        // MGR : tous les groupes créés par eux ou liés à leurs biens
        const { data: d } = await supabase
          .from('tchat_groupes')
          .select('*, tchat_membres(count), biens(adresse,ville)')
          .eq('cree_par', session.user.id)
          .order('created_at', { ascending: false })
        data = d || []
      } else {
        // Locataire : groupes dont il est membre
        const { data: membres } = await supabase
          .from('tchat_membres')
          .select('groupe_id, tchat_groupes(*, biens(adresse,ville))')
          .eq('user_id', session.user.id)
        data = (membres || []).map(m => m.tchat_groupes).filter(Boolean)
      }
      setGroupes(data)
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [session?.user?.id, profile?.role])

  useEffect(() => { loadGroupes() }, [loadGroupes])

  // Charger messages d'un groupe
  async function loadMessages(groupeId) {
    setLoadingMsgs(true)
    try {
      const { data } = await supabase
        .from('tchat_messages')
        .select('*, profiles!user_id(nom, prenom, role)')
        .eq('groupe_id', groupeId)
        .order('created_at', { ascending: true })
        .limit(100)
      setMessages(data || [])
    } catch(e) { console.error(e) }
    finally { setLoadingMsgs(false) }
  }

  // Temps réel
  useEffect(() => {
    if (!selGroupe) return
    loadMessages(selGroupe.id)
    const sub = supabase.channel(`tchat_${selGroupe.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'tchat_messages',
        filter: `groupe_id=eq.${selGroupe.id}`,
      }, payload => {
        setMessages(prev => [...prev, payload.new])
      })
      .subscribe()
    return () => sub.unsubscribe()
  }, [selGroupe?.id])

  // Scroll bas
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function envoyer() {
    if (!text.trim() || !selGroupe) return
    setSending(true)
    try {
      await supabase.from('tchat_messages').insert({
        groupe_id: selGroupe.id,
        user_id: session.user.id,
        contenu: text.trim(),
        epingle: false,
      })
      setText('')
    } catch(e) { console.error(e) }
    finally { setSending(false) }
  }

  async function epingler(msgId, estEpingle) {
    if (!isMgr) return
    await supabase.from('tchat_messages').update({ epingle: !estEpingle }).eq('id', msgId)
    setMessages(prev => prev.map(m => m.id === msgId ? {...m, epingle: !estEpingle} : m))
  }

  async function supprimer(msgId) {
    if (!isMgr) return
    if (!window.confirm('Supprimer ce message ?')) return
    await supabase.from('tchat_messages').delete().eq('id', msgId)
    setMessages(prev => prev.filter(m => m.id !== msgId))
  }

  async function creerGroupe() {
    if (!formGroupe.nom.trim()) { setFormErr('Nom requis'); return }
    try {
      const { data: g, error: e } = await supabase.from('tchat_groupes').insert({
        nom: formGroupe.nom.trim(),
        description: formGroupe.description.trim() || null,
        bien_id: formGroupe.bien_id || null,
        cree_par: session.user.id,
      }).select().single()
      if (e) throw e
      // Ajouter le créateur comme membre admin
      await supabase.from('tchat_membres').insert({ groupe_id: g.id, user_id: session.user.id, role_membre: 'admin' })
      setModalGroupe(false)
      setFormGroupe({ nom: '', description: '' })
      await loadGroupes()
    } catch(e) { setFormErr(e.message) }
  }

  const [biens, setBiens] = useState([])
  useEffect(() => {
    if (!isMgr || !session?.user) return
    supabase.from('biens').select('id,adresse,ville').eq('proprietaire_id', session.user.id)
      .then(({ data }) => setBiens(data || []))
  }, [session?.user?.id])

  // Membres du groupe sélectionné
  const [membres, setMembres] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [showMembres, setShowMembres] = useState(false)

  async function loadMembres(groupeId) {
    const [mR, uR] = await Promise.all([
      supabase.from('tchat_membres').select('*, profiles!user_id(id,nom,prenom,role)').eq('groupe_id', groupeId),
      supabase.from('profiles').select('id,nom,prenom,role').eq('role', 'locataire'),
    ])
    setMembres(mR.data || [])
    setAllUsers(uR.data || [])
  }

  async function ajouterMembre(userId) {
    if (!selGroupe) return
    const deja = membres.find(m => m.user_id === userId)
    if (deja) { alert('Deja membre'); return }
    await supabase.from('tchat_membres').insert({ groupe_id: selGroupe.id, user_id: userId, role_membre: 'membre' })
    await loadMembres(selGroupe.id)
  }

  async function retirerMembre(membreId) {
    if (!window.confirm('Retirer ce membre ?')) return
    await supabase.from('tchat_membres').delete().eq('id', membreId)
    await loadMembres(selGroupe.id)
  }

  const epingles = messages.filter(m => m.epingle)
  const RC = { locataire:'#2B5EA7', proprietaire:'#2D5A3D', agence:'#C8813A', admin:'#B83232' }

  if (loading) return <Layout><div className="it-center"><div className="it-spinner"/></div></Layout>

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Tchat communautaire</h1>
          <p className="page-sub">{groupes.length} groupe(s)</p>
        </div>
        {isMgr && (
          <button className="btn btn-primary" onClick={() => { setFormErr(''); setModalGroupe(true) }}>
            + Nouveau groupe
          </button>
        )}
      </div>

      <div style={{ display:'flex', gap:12, height:'calc(100vh - 185px)', minHeight:400 }}>

        {/* Liste des groupes */}
        <div style={{ width:220, background:'#fff', border:'1px solid rgba(0,0,0,.08)', borderRadius:12, overflow:'auto', flexShrink:0 }}>
          {groupes.length === 0 && (
            <div style={{ padding:20, textAlign:'center', color:'#9E9890', fontSize:13 }}>
              {isMgr ? 'Aucun groupe. Créez-en un.' : 'Vous n\'êtes membre d\'aucun groupe.'}
            </div>
          )}
          {groupes.map(g => (
            <div key={g.id}
              onClick={() => { setSelGroupe(g); setShowMembres(false); loadMembres(g.id) }}
              style={{
                padding:'12px 14px', cursor:'pointer',
                borderBottom:'1px solid rgba(0,0,0,.05)',
                background: selGroupe?.id === g.id ? '#E8F2EB' : 'transparent',
              }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:34, height:34, borderRadius:10, background:'#E8F2EB', color:'#2D5A3D', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>
                  🏘️
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:600, fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{g.nom}</div>
                  <div style={{ fontSize:11, color:'#9E9890' }}>{g.biens?.adresse || 'Sans bien lié'}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Zone chat */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', background:'#fff', border:'1px solid rgba(0,0,0,.08)', borderRadius:12, overflow:'hidden' }}>
          {!selGroupe ? (
            <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:8, color:'#9E9890' }}>
              <span style={{ fontSize:36 }}>🏘️</span>
              <span style={{ fontSize:13 }}>Sélectionnez un groupe</span>
            </div>
          ) : (
            <>
              {/* Header groupe */}
              <div style={{ padding:'12px 16px', borderBottom:'1px solid rgba(0,0,0,.07)', display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:600, fontSize:14 }}>{selGroupe.nom}</div>
                  {selGroupe.description && <div style={{ fontSize:12, color:'#6B6560' }}>{selGroupe.description}</div>}
                  {selGroupe.biens && <div style={{ fontSize:11, color:'#9E9890' }}>📍 {selGroupe.biens.adresse}</div>}
                </div>
                {isMgr && (
                  <button className="btn btn-secondary btn-sm"
                    onClick={() => setShowMembres(s => !s)}>
                    {showMembres ? 'Masquer membres' : `Membres (${membres.length})`}
                  </button>
                )}
              </div>

              {/* Messages épinglés */}
              {epingles.length > 0 && (
                <div style={{ background:'#FDF6E3', padding:'8px 14px', borderBottom:'1px solid rgba(0,0,0,.06)', fontSize:12 }}>
                  <div style={{ fontWeight:600, color:'#8B6914', marginBottom:4 }}>📌 Messages épinglés ({epingles.length})</div>
                  {epingles.map(m => (
                    <div key={m.id} style={{ color:'#6B6560', padding:'2px 0' }}>
                      <strong style={{ color:'#1A1714' }}>{m.profiles?.prenom} {m.profiles?.nom} :</strong> {m.contenu}
                    </div>
                  ))}
                </div>
              )}

              {/* Panneau membres (si ouvert) */}
              {showMembres && isMgr && (
                <div style={{ background:'#F7F5F0', padding:'12px 14px', borderBottom:'1px solid rgba(0,0,0,.07)', maxHeight:180, overflow:'auto' }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#6B6560', textTransform:'uppercase', marginBottom:8 }}>
                    Membres ({membres.length})
                  </div>
                  {membres.map(m => (
                    <div key={m.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 0', fontSize:12 }}>
                      <div style={{ width:24, height:24, borderRadius:'50%', background:RC[m.profiles?.role]||'#9E9890', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, flexShrink:0 }}>
                        {m.profiles?.prenom?.[0]}{m.profiles?.nom?.[0]}
                      </div>
                      <span style={{ flex:1 }}>{m.profiles?.prenom} {m.profiles?.nom}</span>
                      <span style={{ fontSize:10, color:'#9E9890' }}>{m.role_membre}</span>
                      {m.user_id !== session.user.id && (
                        <button onClick={() => retirerMembre(m.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#B83232', fontSize:12 }}>✕</button>
                      )}
                    </div>
                  ))}
                  <div style={{ marginTop:8, borderTop:'1px solid rgba(0,0,0,.07)', paddingTop:8 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#6B6560', textTransform:'uppercase', marginBottom:6 }}>Ajouter un locataire</div>
                    <select
                      onChange={e => { if (e.target.value) { ajouterMembre(e.target.value); e.target.value = '' } }}
                      style={{ padding:'5px 8px', border:'1px solid rgba(0,0,0,.15)', borderRadius:6, fontFamily:'inherit', fontSize:12, outline:'none', width:'100%' }}>
                      <option value="">-- Choisir --</option>
                      {allUsers.filter(u => !membres.find(m => m.user_id === u.id)).map(u => (
                        <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Messages */}
              <div style={{ flex:1, overflowY:'auto', padding:14, display:'flex', flexDirection:'column', gap:8 }}>
                {loadingMsgs && <div className="it-center"><div className="it-spinner"/></div>}
                {!loadingMsgs && messages.length === 0 && (
                  <div style={{ textAlign:'center', color:'#9E9890', fontSize:13, margin:'auto' }}>Aucun message. Soyez le premier !</div>
                )}
                {messages.map(m => {
                  const isMe = m.user_id === session.user.id
                  return (
                    <div key={m.id} style={{ display:'flex', gap:8, alignItems:'flex-start', flexDirection: isMe ? 'row-reverse' : 'row' }}>
                      <div style={{ width:28, height:28, borderRadius:'50%', background:RC[m.profiles?.role]||'#9E9890', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, flexShrink:0 }}>
                        {m.profiles?.prenom?.[0]}{m.profiles?.nom?.[0]}
                      </div>
                      <div style={{ maxWidth:'68%' }}>
                        {!isMe && <div style={{ fontSize:11, color:'#9E9890', marginBottom:2 }}>{m.profiles?.prenom} {m.profiles?.nom}</div>}
                        <div style={{
                          background: m.epingle ? '#FDF6E3' : isMe ? '#E8F2EB' : '#F7F5F0',
                          padding:'8px 12px', borderRadius: isMe ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
                          fontSize:13, lineHeight:1.5, position:'relative',
                          border: m.epingle ? '1px solid rgba(200,129,58,.3)' : 'none',
                        }}>
                          {m.epingle && <span style={{ fontSize:11, marginRight:6 }}>📌</span>}
                          {m.contenu}
                          <div style={{ fontSize:10, color:'#9E9890', marginTop:3, textAlign:'right' }}>
                            {new Date(m.created_at).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' })}
                          </div>
                        </div>
                        {isMgr && (
                          <div style={{ display:'flex', gap:6, marginTop:3 }}>
                            <button onClick={() => epingler(m.id, m.epingle)}
                              style={{ background:'none', border:'none', cursor:'pointer', fontSize:11, color:'#C8813A', padding:'0 2px' }}>
                              {m.epingle ? 'Désépingler' : '📌 Épingler'}
                            </button>
                            <button onClick={() => supprimer(m.id)}
                              style={{ background:'none', border:'none', cursor:'pointer', fontSize:11, color:'#B83232', padding:'0 2px' }}>
                              Supprimer
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
                <div ref={bottomRef}/>
              </div>

              {/* Input */}
              <div style={{ padding:'10px 12px', borderTop:'1px solid rgba(0,0,0,.07)', display:'flex', gap:8 }}>
                <input
                  style={{ flex:1, padding:'9px 13px', border:'1px solid rgba(0,0,0,.15)', borderRadius:20, fontFamily:'inherit', fontSize:13, outline:'none' }}
                  value={text} onChange={e => setText(e.target.value)}
                  onKeyDown={e => e.key==='Enter' && !e.shiftKey && envoyer()}
                  placeholder="Ecrire un message... (Entree pour envoyer)"
                  disabled={sending}
                />
                <button className="btn btn-primary btn-sm" onClick={envoyer} disabled={sending || !text.trim()}>
                  {sending ? '...' : 'Envoyer'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal créer groupe */}
      {modalGroupe && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setModalGroupe(false)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">Nouveau groupe de tchat</span>
              <button className="modal-close" onClick={() => setModalGroupe(false)}>X</button>
            </div>
            <div className="modal-body">
              {formErr && <div className="alert alert-error">{formErr}</div>}
              <div className="alert alert-info" style={{ fontSize:12 }}>
                Créez un groupe par immeuble ou par ensemble de logements. Ajoutez ensuite les locataires concernés.
              </div>
              <div className="fld">
                <label>Nom du groupe *</label>
                <input value={formGroupe.nom} onChange={e=>setFormGroupe(f=>({...f,nom:e.target.value}))} placeholder="Ex: Résidence Les Pins - Immeuble A"/>
              </div>
              <div className="fld">
                <label>Description</label>
                <textarea value={formGroupe.description} onChange={e=>setFormGroupe(f=>({...f,description:e.target.value}))} placeholder="Groupe de discussion pour les locataires du..."/>
              </div>
              {biens.length > 0 && (
                <div className="fld">
                  <label>Bien associé (optionnel)</label>
                  <select value={formGroupe.bien_id||''} onChange={e=>setFormGroupe(f=>({...f,bien_id:e.target.value}))}>
                    <option value="">-- Aucun bien spécifique --</option>
                    {biens.map(b => <option key={b.id} value={b.id}>{b.adresse}, {b.ville}</option>)}
                  </select>
                </div>
              )}
              <button className="btn btn-primary" onClick={creerGroupe}>Créer le groupe</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
